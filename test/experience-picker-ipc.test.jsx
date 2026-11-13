import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import EntityCreatePage from "../src/pages/EntityCreatePage";
import EntityDetailPage from "../src/pages/EntityDetailPage";
import { Route, Routes } from "react-router-dom";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));
const ids = ["22222222-2222-2222-2222-222222222221", "22222222-2222-2222-2222-222222222222"];
const model = {
  people: [], facts: [], links: [],
  experiences: ids.map((experienceId, index) => ({ experienceId, experienceName: ["Life", "Research"][index] })),
};
afterEach(() => { cleanup(); invoke.mockReset(); });

describe("EXPERIENCE picker IPC", () => {
  it.each([
    ["FACT", "Belonging EXPERIENCE", "create_fact", "experienceIds"],
    ["EXPERIENCE", "Parent EXPERIENCE", "create_experience", "parentExperienceIds"],
  ])("TC-08-IPC-PICKER-001 %s sends selected UUIDs from the actual form", async (type, label, command, key) => {
    invoke.mockImplementation((name) => Promise.resolve(name === "load_hasm_model_db" ? model : {}));
    render(<MemoryRouter initialEntries={[{ pathname: "/entity-create", state: { model, path: "fixture.hasm" } }]}>
      <Routes><Route path="/entity-create" element={<EntityCreatePage />} /><Route path="/visualizer" element={<div>Done</div>} /></Routes>
    </MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: type }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New" } });
    const search = screen.getByRole("combobox", { name: label });
    fireEvent.focus(search);
    fireEvent.click(screen.getByRole("option", { name: "Life" }));
    fireEvent.change(search, { target: { value: "research" } });
    fireEvent.click(screen.getByRole("option", { name: "Research" }));
    fireEvent.click(screen.getByRole("button", { name: `Create ${type}` }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith(command, {
      path: "fixture.hasm", payload: expect.objectContaining({ [key]: ids }),
    }));
  });

  it.each([
    ["FACT", "Experiences", "save_fact_detail", "experienceIds"],
    ["EXPERIENCE", "Parent experiences", "save_experience_detail", "parentExperienceIds"],
  ])("TC-04-IPC-PICKER-001 %s saves editable relationships through invoke", async (type, label, command, key) => {
    const detail = type === "FACT"
      ? { factId: "fact", factName: "Original", experienceIds: [ids[0]], personIds: [], linkIds: [] }
      : { experienceId: "current", experienceName: "Original", personId: "11111111-1111-1111-1111-111111111111", parentExperienceIds: [ids[0]], linkIds: [] };
    const currentModel = { ...model, [type === "FACT" ? "facts" : "experiences"]: type === "FACT" ? [detail] : [...model.experiences, detail] };
    invoke.mockImplementation((name) => {
      if (name === "load_entity_detail") return Promise.resolve({ name: "Original", detail, markdownBody: "", loadedMtimeMs: 0 });
      if (name === "compute_visualizer_layout") return Promise.resolve({ nodes3d: [], lines3d: [], warnings: [] });
      return Promise.resolve({});
    });
    render(<MemoryRouter initialEntries={[{ pathname: `/entity-detail/${type}/current`, state: { model: currentModel, path: "fixture.hasm", isVerified: true } }]}>
      <Routes><Route path="/entity-detail/:entityType/:entityId" element={<EntityDetailPage />} /></Routes>
    </MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Edit details" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Life" }));
    const search = screen.getByRole("combobox", { name: label });
    fireEvent.focus(search);
    fireEvent.change(search, { target: { value: "research" } });
    expect(within(screen.getByRole("listbox", { name: label })).getAllByRole("option")).toHaveLength(1);
    fireEvent.click(screen.getByRole("option", { name: "Research" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith(command, {
      modelRoot: "fixture.hasm", detail: expect.objectContaining({ [key]: [ids[1]] }),
    }));
  });

  it("TC-04-IPC-PICKER-002 preserves unresolved selections without exposing their UUID", async () => {
    const detail = { factId: "fact", factName: "Original", experienceIds: [ids[0]], personIds: [], linkIds: [] };
    const currentModel = { ...model, experiences: [], facts: [detail] };
    invoke.mockImplementation((name) => {
      if (name === "load_entity_detail") return Promise.resolve({ name: "Original", detail, markdownBody: "", loadedMtimeMs: 0 });
      if (name === "compute_visualizer_layout") return Promise.resolve({ nodes3d: [], lines3d: [], warnings: [] });
      return Promise.resolve({});
    });
    render(<MemoryRouter initialEntries={[{ pathname: "/entity-detail/FACT/fact", state: { model: currentModel, path: "fixture.hasm", isVerified: true } }]}>
      <Routes><Route path="/entity-detail/:entityType/:entityId" element={<EntityDetailPage />} /></Routes>
    </MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Edit details" }));
    expect(screen.getByRole("button", { name: "Remove Unavailable EXPERIENCE" })).toBeInTheDocument();
    expect(screen.getByLabelText("Edit details")).not.toHaveTextContent(ids[0]);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("save_fact_detail", {
      modelRoot: "fixture.hasm", detail: expect.objectContaining({ experienceIds: [ids[0]] }),
    }));
  });
});
