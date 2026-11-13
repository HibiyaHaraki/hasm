import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import EntityCreatePage from "../src/pages/EntityCreatePage";
import EntityDetailPage from "../src/pages/EntityDetailPage";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));
const model = { people: [], experiences: [], facts: [], links: [] };
afterEach(() => { cleanup(); invoke.mockReset(); });

describe("Date calendar IPC", () => {
  it("TC-08-IPC-DATE-001 selects FACT dates with calendar-only controls through the create invoke", async () => {
    invoke.mockImplementation((name) => Promise.resolve(name === "load_hasm_model_db" ? model : {}));
    render(<MemoryRouter initialEntries={[{ pathname: "/entity-create", state: { model, path: "fixture.hasm" } }]}>
      <Routes><Route path="/entity-create" element={<EntityCreatePage />} /><Route path="/visualizer" element={<div>Done</div>} /></Routes>
    </MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "FACT" }));
    expect(screen.getByLabelText("Start date")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("End date")).toHaveAttribute("type", "date");
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2024-02-29" } });
    fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2024-03-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Create FACT" }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("create_fact", {
      path: "fixture.hasm", payload: expect.objectContaining({ startTime: "2024-02-29", endTime: "2024-03-01" }),
    }));
  });

  it.each([
    ["PERSON", { personId: "id", birthday: "not-a-date", die: "2001-01-01", linkIds: [] }, "Birthday", "birthday", "save_person_detail"],
    ["PERSON", { personId: "id", birthday: "", die: "2001-01-01", linkIds: [] }, "Date of death", "die", "save_person_detail"],
    ["FACT", { factId: "id", occurredAt: "2020-01-01T15:40:00Z", experienceIds: [], personIds: [], linkIds: [] }, "Occurred at", "occurredAt", "save_fact_detail"],
  ])("TC-04-IPC-DATE-001 %s %s calendar edits the existing detail payload", async (type, detail, label, key, command) => {
    invoke.mockImplementation((name) => {
      if (name === "load_entity_detail") return Promise.resolve({ name: "Original", detail, markdownBody: "", loadedMtimeMs: 0 });
      if (name === "compute_visualizer_layout") return Promise.resolve({ nodes3d: [], lines3d: [], warnings: [] });
      return Promise.resolve({});
    });
    render(<MemoryRouter initialEntries={[{ pathname: `/entity-detail/${type}/id`, state: { model, path: "fixture.hasm", isVerified: true } }]}>
      <Routes><Route path="/entity-detail/:entityType/:entityId" element={<EntityDetailPage />} /></Routes>
    </MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Edit details" }));
    expect(screen.getByLabelText(label)).toHaveAttribute("type", "date");
    if (key === "occurredAt") expect(screen.getByText("Existing time and timezone retained: T15:40:00Z")).toBeInTheDocument();
    if (detail[key] === "not-a-date") expect(screen.getByText(/Saved date cannot be shown in the calendar: not-a-date/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(label), { target: { value: "2024-02-29" } });
    const expected = key === "occurredAt" ? "2024-02-29T15:40:00Z" : "2024-02-29";
    expect(screen.getByLabelText(label)).toHaveValue("2024-02-29");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith(command, {
      modelRoot: "fixture.hasm", detail: expect.objectContaining({ [key]: expected }),
    }));
  });

  it("TC-04-IPC-DATE-002 keeps invalid stored text unchanged and translates calendar labels", async () => {
    const detail = { personId: "id", birthday: "invalid date", die: "", linkIds: [] };
    invoke.mockImplementation((name) => {
      if (name === "load_entity_detail") return Promise.resolve({ name: "Original", detail, markdownBody: "", loadedMtimeMs: 0 });
      if (name === "compute_visualizer_layout") return Promise.resolve({ nodes3d: [], lines3d: [], warnings: [] });
      return Promise.resolve({});
    });
    render(<MemoryRouter initialEntries={[{ pathname: "/entity-detail/PERSON/id", state: { model, path: "fixture.hasm", isVerified: true } }]}>
      <Routes><Route path="/entity-detail/:entityType/:entityId" element={<EntityDetailPage />} /></Routes>
    </MemoryRouter>);
    await screen.findByRole("button", { name: "Edit details" });
    fireEvent.change(screen.getByLabelText("Language"), { target: { value: "ja" } });
    fireEvent.click(screen.getByRole("button", { name: "詳細を編集" }));
    expect(screen.getByLabelText("生年月日")).toHaveValue("");
    expect(screen.getByText(/保存された日付をカレンダーに表示できません: invalid date/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("save_person_detail", {
      modelRoot: "fixture.hasm", detail: expect.objectContaining({ birthday: "invalid date" }),
    }));
  });
});
