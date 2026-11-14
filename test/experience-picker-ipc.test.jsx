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
afterEach(() => { cleanup(); invoke.mockReset(); vi.unstubAllEnvs(); });

describe("EXPERIENCE picker IPC", () => {
  it.each([
    ["FACT", "Belonging EXPERIENCE", "experienceIds"],
    ["EXPERIENCE", "Parent EXPERIENCE", "parentExperienceIds"],
    ["EXPERIENCE", "Belonging FACT", "factIds"],
  ])("TC-08-IPC-DESIGN-001 %s %s shares one badge field with dropdown-first search", async (type, label, key) => {
    const currentModel = { ...model, facts: ids.map((factId, index) => ({ factId, factName: ["Life", "Research"][index] })) };
    invoke.mockImplementation((name) => Promise.resolve(name === "load_hasm_model_db" ? currentModel : {}));
    render(<MemoryRouter initialEntries={[{ pathname: "/entity-create", state: { model: currentModel, path: "fixture.hasm" } }]}>
      <Routes><Route path="/entity-create" element={<EntityCreatePage />} /><Route path="/visualizer" element={<div>Done</div>} /></Routes>
    </MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: type }));
    const field = screen.getByRole("combobox", { name: label });
    const searchLabel = label === "Belonging FACT" ? "Search belonging FACTs" : `Search ${label}`;
    expect(screen.queryByRole("searchbox", { name: searchLabel })).not.toBeInTheDocument();
    fireEvent.click(field);
    const search = screen.getByRole("searchbox", { name: searchLabel });
    expect(search).toHaveFocus();
    expect(search.closest(".experience-multi-menu").firstElementChild).toContainElement(search);
    fireEvent.keyDown(search, { key: "Enter" });
    const list = screen.getByRole("listbox", { name: label });
    const choices = within(list).getAllByRole("option");
    expect(choices[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.click(choices[1]);
    const badges = field.closest(".experience-multi-field").querySelectorAll(".badge");
    expect(badges).toHaveLength(2);
    expect(within(badges[0]).getByRole("button", { name: /^Remove / })).toBeInTheDocument();
    fireEvent.keyDown(choices[1], { key: "Escape" });
    expect(screen.queryByRole("listbox", { name: label })).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox", { name: searchLabel })).not.toBeInTheDocument();
    expect(field).toHaveFocus();
    fireEvent.click(within(badges[0]).getByRole("button", { name: /^Remove / }));
    expect(field.closest(".experience-multi-field").querySelectorAll(".badge")).toHaveLength(1);
    expect(field).toHaveAttribute("aria-expanded", "false");
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New" } });
    fireEvent.click(screen.getByRole("button", { name: `Create ${type}` }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith(`create_${type.toLowerCase()}`, {
      path: "fixture.hasm", payload: expect.objectContaining({ [key]: [ids[1]] }),
    }));
  });

  it.each([
    ["FACT", "Belonging EXPERIENCE"],
    ["EXPERIENCE", "Parent EXPERIENCE"],
    ["EXPERIENCE", "Belonging FACT"],
  ])("TC-08-IPC-DESIGN-002 %s %s keeps badges on no matches without submitting", (type, label) => {
    const currentModel = { ...model, facts: [{ factId: ids[0], factName: "Life" }] };
    render(<MemoryRouter initialEntries={[{ state: { model: currentModel, path: "fixture.hasm" } }]}><EntityCreatePage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: type }));
    const field = screen.getByRole("combobox", { name: label });
    fireEvent.click(field);
    const search = screen.getByRole("searchbox", { name: label === "Belonging FACT" ? "Search belonging FACTs" : `Search ${label}` });
    fireEvent.keyDown(search, { key: "Enter" });
    fireEvent.change(search, { target: { value: "nothing matches" } });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(screen.getByRole("status")).toHaveTextContent(/No matching/);
    expect(field.closest(".experience-multi-field").querySelectorAll(".badge")).toHaveLength(1);
    expect(invoke).not.toHaveBeenCalled();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("listbox", { name: label })).not.toBeInTheDocument();
    expect(field.closest(".experience-multi-field").querySelectorAll(".badge")).toHaveLength(1);
  });

  it("TC-08-IPC-SEC-003 leaves the level visible when the build flag is unset", () => {
    vi.stubEnv("VITE_ENABLE_SECURITY_LEVEL", undefined);
    render(<MemoryRouter initialEntries={[{ state: { model, path: "fixture.hasm" } }]}><EntityCreatePage /></MemoryRouter>);
    expect(screen.getByLabelText("Security level")).toHaveValue(1);
  });

  it.each(["PERSON", "EXPERIENCE", "FACT", "LINK"])("TC-08-IPC-SEC-001 %s hides the level but sends the default through invoke", async (type) => {
    vi.stubEnv("VITE_ENABLE_SECURITY_LEVEL", "false");
    invoke.mockImplementation((name) => Promise.resolve(name === "load_hasm_model_db" ? model : {}));
    render(<MemoryRouter initialEntries={[{ pathname: "/entity-create", state: { model, path: "fixture.hasm" } }]}>
      <Routes><Route path="/entity-create" element={<EntityCreatePage />} /><Route path="/visualizer" element={<div>Done</div>} /></Routes>
    </MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: type }));
    expect(screen.queryByLabelText("Security level")).not.toBeInTheDocument();
    if (type !== "LINK") fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New" } });
    fireEvent.click(screen.getByRole("button", { name: `Create ${type}` }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith(`create_${type.toLowerCase()}`, {
      path: "fixture.hasm", payload: expect.objectContaining({ securityLevel: 1 }),
    }));
  });

  it.each(["PERSON", "EXPERIENCE", "FACT", "LINK"])("TC-08-IPC-SEC-002 %s retains the editable level when enabled", async (type) => {
    vi.stubEnv("VITE_ENABLE_SECURITY_LEVEL", "true");
    invoke.mockImplementation((name) => Promise.resolve(name === "load_hasm_model_db" ? model : {}));
    render(<MemoryRouter initialEntries={[{ pathname: "/entity-create", state: { model, path: "fixture.hasm" } }]}>
      <Routes><Route path="/entity-create" element={<EntityCreatePage />} /><Route path="/visualizer" element={<div>Done</div>} /></Routes>
    </MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: type }));
    fireEvent.change(screen.getByLabelText("Security level"), { target: { value: "3" } });
    if (type !== "LINK") fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New" } });
    fireEvent.click(screen.getByRole("button", { name: `Create ${type}` }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith(`create_${type.toLowerCase()}`, {
      path: "fixture.hasm", payload: expect.objectContaining({ securityLevel: 3 }),
    }));
  });

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
    fireEvent.click(screen.getByRole("combobox", { name: label }));
    const search = screen.getByRole("searchbox", { name: `Search ${label}` });
    fireEvent.click(screen.getByRole("option", { name: "Life" }));
    fireEvent.change(search, { target: { value: "research" } });
    fireEvent.click(screen.getByRole("option", { name: "Research" }));
    fireEvent.click(screen.getByRole("button", { name: `Create ${type}` }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith(command, {
      path: "fixture.hasm", payload: expect.objectContaining({ [key]: ids }),
    }));
  });

  it("TC-08-IPC-FACTS-001 searches and multi-selects existing FACTs through the actual creation invoke", async () => {
    const facts = ids.map((factId) => ({ factId, factName: "Same title" }));
    const currentModel = { ...model, facts };
    invoke.mockImplementation((name) => Promise.resolve(name === "load_hasm_model_db" ? currentModel : {}));
    render(<MemoryRouter initialEntries={[{ pathname: "/entity-create", state: { model: currentModel, path: "fixture.hasm" } }]}>
      <Routes><Route path="/entity-create" element={<EntityCreatePage />} /><Route path="/visualizer" element={<div>Done</div>} /></Routes>
    </MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "EXPERIENCE" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New" } });
    fireEvent.click(screen.getByRole("combobox", { name: "Belonging FACT" }));
    fireEvent.change(screen.getByLabelText("Search belonging FACTs"), { target: { value: "  SAME TITLE  " } });
    const choices = screen.getAllByRole("option");
    expect(choices).toHaveLength(2);
    expect(choices[0]).toHaveTextContent(ids[0]);
    expect(choices[1]).toHaveTextContent(ids[1]);
    fireEvent.click(choices[0]);
    expect(choices[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.click(choices[1]);
    fireEvent.change(screen.getByLabelText("Search belonging FACTs"), { target: { value: "missing" } });
    expect(screen.getByRole("button", { name: `Remove FACT Same title (${ids[0]})` })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Remove FACT Same title (${ids[1]})` })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("No matching FACTs.");
    fireEvent.click(screen.getByRole("button", { name: "FACT", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "EXPERIENCE" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Belonging FACT" }));
    expect(screen.getByLabelText("Search belonging FACTs")).toHaveValue("missing");
    fireEvent.click(screen.getByRole("button", { name: "Create EXPERIENCE" }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("create_experience", {
      path: "fixture.hasm", payload: {
        link: [], experienceName: "New", experienceDescription: "", securityLevel: 1,
        parentExperienceIds: [], factIds: ids,
      },
    }));
    expect(await screen.findByText("Done")).toBeInTheDocument();
  });

  it("TC-08-IPC-FACTS-002 clears FACT selections and surfaces creation errors without reloading", async () => {
    const currentModel = { ...model, facts: [{ factId: ids[0], factName: "" }] };
    invoke.mockRejectedValue(new Error("FACT no longer exists"));
    render(<MemoryRouter initialEntries={[{ state: { model: currentModel, path: "fixture.hasm" } }]}><EntityCreatePage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "EXPERIENCE" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Belonging FACT" }));
    const search = screen.getByLabelText("Search belonging FACTs");
    fireEvent.change(search, { target: { value: ids[0].toUpperCase() } });
    const choice = screen.getByRole("option", { name: `FACT Untitled FACT (${ids[0]})` });
    fireEvent.click(choice);
    fireEvent.click(choice);
    expect(choice).toHaveAttribute("aria-selected", "false");
    fireEvent.click(choice);
    fireEvent.click(screen.getByRole("button", { name: "Clear Belonging FACT" }));
    expect(choice).toHaveAttribute("aria-selected", "false");
    fireEvent.click(screen.getByRole("button", { name: "Create EXPERIENCE" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("FACT no longer exists");
    expect(invoke).toHaveBeenCalledWith("create_experience", {
      path: "fixture.hasm", payload: expect.objectContaining({ factIds: [] }),
    });
    expect(invoke).not.toHaveBeenCalledWith("load_hasm_model_db", expect.anything());
  });

  it("TC-08-IPC-FACTS-003 creates an EXPERIENCE without FACTs in an empty FACT list", async () => {
    invoke.mockImplementation((name) => Promise.resolve(name === "load_hasm_model_db" ? model : {}));
    render(<MemoryRouter initialEntries={[{ pathname: "/entity-create", state: { model, path: "fixture.hasm" } }]}>
      <Routes><Route path="/entity-create" element={<EntityCreatePage />} /><Route path="/visualizer" element={<div>Done</div>} /></Routes>
    </MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "EXPERIENCE" }));
    expect(screen.queryByLabelText("Search belonging FACTs")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Belonging FACT" })).toBeDisabled();
    expect(screen.getByText(/You can create an EXPERIENCE without FACTs/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Independent" } });
    fireEvent.click(screen.getByRole("button", { name: "Create EXPERIENCE" }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("create_experience", {
      path: "fixture.hasm", payload: expect.objectContaining({ factIds: [] }),
    }));
    expect(await screen.findByText("Done")).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("combobox", { name: label }));
    const search = screen.getByRole("searchbox", { name: `Search ${label}` });
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
