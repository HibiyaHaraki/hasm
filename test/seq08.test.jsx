import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import EntityCreatePage from "../src/pages/EntityCreatePage";
import ModelInitializationPage from "../src/pages/ModelInitializationPage";
import VisualizerPage from "../src/pages/VisualizerPage";
import * as api from "../src/features/hasm/api";

vi.mock("../src/features/hasm/api", () => ({
  computeVisualizerLayout: vi.fn(),
  createPerson: vi.fn(),
  createExperience: vi.fn(),
  createFact: vi.fn(),
  createLink: vi.fn(),
  loadHasmModelDb: vi.fn(),
  switchWorkspaceCleanly: vi.fn(),
  subscribeToTauriEvent: vi.fn(),
}));
vi.mock("../src/hasm_visualizer/threeCommitGraph.js", async () => {
  const actual = await vi.importActual("../src/hasm_visualizer/threeCommitGraph.js");
  return { ...actual, createCommitGraph: vi.fn(() => () => {}) };
});

const model = {
  people: [{ personId: "11111111-1111-1111-1111-111111111111", personName: "John" }],
  experiences: [{ experienceId: "22222222-2222-2222-2222-222222222222", experienceName: "Root" }],
  facts: [{ factId: "33333333-3333-3333-3333-333333333333", factName: "Fact A" }],
  links: [],
};

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("SEQ-08 entity creation navigation and forms", () => {
  it("TC-08-REACT-SEARCH-001 independently searches LINK endpoints and submits selected entities", async () => {
    api.createLink.mockResolvedValue({});
    api.loadHasmModelDb.mockResolvedValue(model);
    render(<MemoryRouter initialEntries={[{ pathname: "/entity-create", state: { model, path: "C:/fixture.hasm" } }]}>
      <Routes><Route path="/entity-create" element={<EntityCreatePage />} /><Route path="/visualizer" element={<LocationProbe />} /></Routes>
    </MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "LINK" }));
    fireEvent.change(screen.getByLabelText("Search origin entities"), { target: { value: "  jOhN  " } });
    const origin = screen.getByLabelText("Origin");
    const target = screen.getByLabelText("Target");
    expect(within(origin).getAllByRole("option")).toHaveLength(2);
    expect(within(target).getAllByRole("option")).toHaveLength(4);
    fireEvent.change(origin, { target: { value: `PERSON:${model.people[0].personId}` } });
    fireEvent.change(screen.getByLabelText("Search target entities"), { target: { value: "FACT" } });
    expect(within(target).getAllByRole("option")).toHaveLength(2);
    fireEvent.change(target, { target: { value: `FACT:${model.facts[0].factId}` } });
    fireEvent.click(screen.getByRole("button", { name: "Create LINK" }));
    await vi.waitFor(() => expect(api.createLink).toHaveBeenCalledWith("C:/fixture.hasm", {
      link: [], linkType: "references", linkDescription: "", securityLevel: 1,
      originEntityType: "PERSON", originEntityId: model.people[0].personId,
      targetEntityType: "FACT", targetEntityId: model.facts[0].factId,
    }));
    expect(await screen.findByTestId("location")).toHaveTextContent("/visualizer");
  });

  it("TC-08-REACT-SEARCH-002 handles no results, retained selections, clearing, and form switching", () => {
    render(<MemoryRouter initialEntries={[{ state: { model, path: "C:/fixture.hasm" } }]}><EntityCreatePage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "LINK" }));
    fireEvent.change(screen.getByLabelText("Search origin entities"), { target: { value: "no-match" } });
    expect(within(screen.getByLabelText("Origin")).getAllByRole("option")).toHaveLength(1);
    expect(screen.getByText("No matching entities.")).toBeInTheDocument();
    expect(api.createLink).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Search origin entities"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Origin"), { target: { value: `PERSON:${model.people[0].personId}` } });
    fireEvent.change(screen.getByLabelText("Search origin entities"), { target: { value: "Root" } });
    expect(screen.getByLabelText("Origin")).toHaveValue(`PERSON:${model.people[0].personId}`);
    expect(within(screen.getByLabelText("Origin")).getByRole("group", { name: "Current selection (outside search results)" })).toBeInTheDocument();
    expect(screen.getByText(/Current selection is retained/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "PERSON" }));
    fireEvent.click(screen.getByRole("button", { name: "LINK" }));
    expect(screen.getByLabelText("Search origin entities")).toHaveValue("Root");
    expect(screen.getByLabelText("Origin")).toHaveValue(`PERSON:${model.people[0].personId}`);
    fireEvent.change(screen.getByLabelText("Search origin entities"), { target: { value: "" } });
    expect(within(screen.getByLabelText("Origin")).getAllByRole("option")).toHaveLength(4);
    fireEvent.change(screen.getByLabelText("Origin"), { target: { value: "" } });
    expect(screen.getByLabelText("Origin")).toHaveValue("");
  });

  it("TC-08-REACT-SEARCH-003 distinguishes duplicate names and searches unnamed entities by UUID", () => {
    const people = [
      model.people[0],
      { personId: "11111111-1111-1111-1111-111111111112", personName: "John" },
      { personId: "11111111-1111-1111-1111-111111111113", personName: "" },
    ];
    render(<MemoryRouter initialEntries={[{ state: { model: { ...model, people }, path: "C:/fixture.hasm" } }]}><EntityCreatePage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "LINK" }));
    fireEvent.change(screen.getByLabelText("Search target entities"), { target: { value: "John" } });
    const target = screen.getByLabelText("Target");
    expect(within(target).getAllByRole("option")).toHaveLength(3);
    for (const person of people.slice(0, 2)) {
      expect(within(target).getByRole("option", { name: `PERSON John (${person.personId})` })).toHaveValue(`PERSON:${person.personId}`);
    }
    fireEvent.change(screen.getByLabelText("Search target entities"), { target: { value: people[2].personId } });
    expect(within(target).getAllByRole("option")).toHaveLength(2);
    fireEvent.change(target, { target: { value: `PERSON:${people[2].personId}` } });
    expect(target).toHaveValue(`PERSON:${people[2].personId}`);
  });

  it("TC-08-REACT-LINK-001 includes URL arrays in all four creation payloads", async () => {
    for (const [type, create] of [["PERSON", api.createPerson], ["EXPERIENCE", api.createExperience], ["FACT", api.createFact], ["LINK", api.createLink]]) {
      create.mockResolvedValue({});
      api.loadHasmModelDb.mockResolvedValue(model);
      render(<MemoryRouter initialEntries={[{ pathname: "/entity-create", state: { model, path: "C:/fixture.hasm" } }]}>
        <Routes><Route path="/entity-create" element={<EntityCreatePage />} /><Route path="/visualizer" element={<LocationProbe />} /></Routes>
      </MemoryRouter>);
      fireEvent.click(screen.getByRole("button", { name: type }));
      expect(screen.queryByLabelText("Description")).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Add link" }));
      fireEvent.change(screen.getByLabelText("Link 1"), { target: { value: "https://example.org/source" } });
      fireEvent.click(screen.getByRole("button", { name: `Create ${type}` }));
      await vi.waitFor(() => expect(create).toHaveBeenCalledWith("C:/fixture.hasm", expect.objectContaining({ link: ["https://example.org/source"] })));
      const descriptionKey = { PERSON: "personDescription", EXPERIENCE: "experienceDescription", FACT: "factDescription", LINK: "linkDescription" }[type];
      expect(create).toHaveBeenCalledWith("C:/fixture.hasm", expect.objectContaining({ [descriptionKey]: "" }));
      await screen.findByTestId("location");
      cleanup(); vi.resetAllMocks();
    }
  });
  it.each([
    ["FACT", "Belonging EXPERIENCE", "experienceIds", "createFact"],
    ["EXPERIENCE", "Parent EXPERIENCE", "parentExperienceIds", "createExperience"],
  ])("TC-08-REACT-REL-001 %s lists all experiences and submits multiple selected UUIDs", async (type, label, key, command) => {
    const experiences = [
      { experienceId: "22222222-2222-2222-2222-222222222221", experienceName: "Shared name" },
      { experienceId: "22222222-2222-2222-2222-222222222222", experienceName: "Shared name" },
      { experienceId: "22222222-2222-2222-2222-222222222223", experienceName: "" },
    ];
    api[command].mockResolvedValue({});
    api.loadHasmModelDb.mockResolvedValue(model);
    render(<MemoryRouter initialEntries={[{ pathname: "/entity-create", state: { model: { ...model, experiences }, path: "C:/fixture.hasm" } }]}>
      <Routes><Route path="/entity-create" element={<EntityCreatePage />} /><Route path="/visualizer" element={<LocationProbe />} /></Routes>
    </MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: type }));
    const select = screen.getByRole("listbox", { name: label });
    expect(select).toHaveAttribute("multiple");
    expect(within(select).getAllByRole("option")).toHaveLength(3);
    for (const experience of experiences) {
      expect(within(select).getByRole("option", { name: `${experience.experienceName || "Untitled EXPERIENCE"} (${experience.experienceId})` }))
        .toHaveValue(experience.experienceId);
    }
    select.options[0].selected = true;
    select.options[2].selected = true;
    fireEvent.change(select);
    fireEvent.click(screen.getByRole("button", { name: "PERSON" }));
    fireEvent.click(screen.getByRole("button", { name: type }));
    const selectedIds = [experiences[0].experienceId, experiences[2].experienceId];
    expect(screen.getByLabelText(label)).toHaveValue(selectedIds);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New entity" } });
    fireEvent.click(screen.getByRole("button", { name: `Create ${type}` }));
    await vi.waitFor(() => expect(api[command]).toHaveBeenCalledWith("C:/fixture.hasm",
      expect.objectContaining({ [key]: selectedIds })));
    await screen.findByTestId("location");
  });

  it.each([
    ["FACT", "Belonging EXPERIENCE", "experienceIds", "createFact"],
    ["EXPERIENCE", "Parent EXPERIENCE", "parentExperienceIds", "createExperience"],
  ])("TC-08-REACT-REL-002 %s supports clearing a selection and empty experience lists", async (type, label, key, command) => {
    api[command].mockRejectedValue(new Error("Creation failed"));
    render(<MemoryRouter initialEntries={[{ state: { model, path: "C:/fixture.hasm" } }]}><EntityCreatePage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: type }));
    fireEvent.change(screen.getByLabelText(label), { target: { value: model.experiences[0].experienceId } });
    expect(screen.getByLabelText(label)).toHaveValue([model.experiences[0].experienceId]);
    fireEvent.click(screen.getByRole("button", { name: `Clear ${label}` }));
    expect(screen.getByLabelText(label)).toHaveValue([]);
    fireEvent.click(screen.getByRole("button", { name: `Create ${type}` }));
    await vi.waitFor(() => expect(api[command]).toHaveBeenCalledWith("C:/fixture.hasm", expect.objectContaining({ [key]: [] })));
    expect(await screen.findByRole("alert")).toHaveTextContent("Creation failed");
    cleanup();
    render(<MemoryRouter initialEntries={[{ state: { model: { ...model, experiences: [] }, path: "C:/fixture.hasm" } }]}><EntityCreatePage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: type }));
    expect(screen.getByLabelText(label)).toBeDisabled();
    expect(screen.getByRole("option", { name: "No EXPERIENCE available" })).toHaveValue("");
  });
  it("TC-08-REACT-001 shows Create New Entity button on Visualizer and moves to creation page", async () => {
    api.subscribeToTauriEvent.mockResolvedValue(() => {});
    api.computeVisualizerLayout.mockResolvedValue({ nodes3d: [], lines3d: [], warnings: [] });

    render(
      <MemoryRouter initialEntries={[{ pathname: "/visualizer", state: { model, path: "C:/fixture.hasm", isVerified: true } }]}>
        <Routes>
          <Route path="/visualizer" element={<VisualizerPage />} />
          <Route path="/entity-create" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Create New Entity" }));
    expect(await screen.findByTestId("location")).toHaveTextContent("/entity-create");
  });

  it("TC-08-REACT-002 creates PERSON on dedicated page and returns to visualizer", async () => {
    api.createPerson.mockResolvedValue({ entityType: "PERSON", entityId: "new-person" });
    api.loadHasmModelDb.mockResolvedValue({ ...model, people: [...model.people, { personId: "new-person" }] });

    render(
      <MemoryRouter initialEntries={[{ pathname: "/entity-create", state: { model, path: "C:/fixture.hasm", isVerified: true } }]}>
        <Routes>
          <Route path="/entity-create" element={<EntityCreatePage />} />
          <Route path="/visualizer" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Jane" } });
    fireEvent.click(screen.getByRole("button", { name: "Create PERSON" }));

    await vi.waitFor(() =>
      expect(api.createPerson).toHaveBeenCalledWith("C:/fixture.hasm", expect.objectContaining({ personName: "Jane" })),
    );
    expect(await screen.findByTestId("location")).toHaveTextContent("/visualizer");
  });

  it("TC-08-REACT-003 shows backend link validation errors on dedicated page", async () => {
    api.createLink.mockRejectedValue(new Error("SelfLoopLink"));

    render(
      <MemoryRouter initialEntries={[{ pathname: "/entity-create", state: { model, path: "C:/fixture.hasm", isVerified: true } }]}>
        <Routes>
          <Route path="/entity-create" element={<EntityCreatePage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "LINK" }));
    fireEvent.change(screen.getByLabelText("Origin"), { target: { value: "PERSON:11111111-1111-1111-1111-111111111111" } });
    fireEvent.change(screen.getByLabelText("Target"), { target: { value: "PERSON:11111111-1111-1111-1111-111111111111" } });
    fireEvent.click(screen.getByRole("button", { name: "Create LINK" }));

    expect(await screen.findByText("SelfLoopLink")).toBeInTheDocument();
  });

  it("TC-08-REACT-004 confirms name and birth date before initializing an empty model", async () => {
    api.createPerson.mockResolvedValue({ entityType: "PERSON", entityId: "new-person" });
    api.loadHasmModelDb.mockResolvedValue({ ...model, people: [{ personId: "new-person", personName: "Bootstrap" }] });

    render(
      <MemoryRouter initialEntries={[{ pathname: "/initialize-model", state: { path: "C:/fixture.hasm" } }]}>
        <Routes>
          <Route path="/initialize-model" element={<ModelInitializationPage />} />
          <Route path="/visualizer" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("PERSON name (required)"), { target: { value: " Bootstrap " } });
    expect(screen.getByRole("button", { name: "Review model" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Birth date (required)"), { target: { value: "2000-02-29" } });
    fireEvent.click(screen.getByRole("button", { name: "Review model" }));

    const dialog = await screen.findByRole("dialog", { name: "Confirm new HASM model" });
    expect(dialog).toHaveTextContent("Bootstrap");
    expect(dialog).toHaveTextContent("2000-02-29");
    expect(dialog).toHaveTextContent("Bootstrap Life");
    expect(dialog).toHaveTextContent("Bootstrap Birth date");
    expect(api.createPerson).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm and create model" }));

    await vi.waitFor(() =>
      expect(api.createPerson).toHaveBeenCalledWith("C:/fixture.hasm", {
        personName: "Bootstrap", birthDate: "2000-02-29", personDescription: "",
        securityLevel: 1, createLifeExperience: true,
      }),
    );
    expect(await screen.findByTestId("location")).toHaveTextContent("/visualizer");
  });

  it("TC-08-REACT-005 returns to edit without persisting and confirms revised input", async () => {
    api.createPerson.mockResolvedValue({});
    api.loadHasmModelDb.mockResolvedValue(model);
    render(<MemoryRouter initialEntries={[{ state: { path: "C:/fixture.hasm" } }]}>
      <ModelInitializationPage />
    </MemoryRouter>);
    fireEvent.change(screen.getByLabelText("PERSON name (required)"), { target: { value: "Original" } });
    fireEvent.change(screen.getByLabelText("Birth date (required)"), { target: { value: "2000-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Review model" }));
    fireEvent.click(await screen.findByRole("button", { name: "Back to edit" }));
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(api.createPerson).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Birth date (required)")).toHaveValue("2000-01-01");
    fireEvent.change(screen.getByLabelText("PERSON name (required)"), { target: { value: "Revised" } });
    fireEvent.click(screen.getByRole("button", { name: "Review model" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("Revised Life");
  });

  it("TC-08-REACT-006 reports creation errors and blocks duplicate submissions", async () => {
    let rejectCreation;
    api.createPerson.mockImplementation(() => new Promise((_, reject) => { rejectCreation = reject; }));
    render(<MemoryRouter initialEntries={[{ state: { path: "C:/fixture.hasm" } }]}>
      <ModelInitializationPage />
    </MemoryRouter>);
    fireEvent.change(screen.getByLabelText("PERSON name (required)"), { target: { value: "Person" } });
    fireEvent.change(screen.getByLabelText("Birth date (required)"), { target: { value: "2000-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Review model" }));
    const confirm = await screen.findByRole("button", { name: "Confirm and create model" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(api.createPerson).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Back to edit" })).toBeDisabled();
    rejectCreation(new Error("Birth FACT could not be saved"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Birth FACT could not be saved");
    expect(api.loadHasmModelDb).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Back to edit" })).toBeEnabled();
  });

  it("TC-08-REACT-007 retries loading without duplicating initialized entities", async () => {
    api.createPerson.mockResolvedValue({});
    api.loadHasmModelDb.mockRejectedValueOnce(new Error("Database temporarily unavailable")).mockResolvedValue(model);
    render(<MemoryRouter initialEntries={[{ pathname: "/initialize-model", state: { path: "C:/fixture.hasm" } }]}>
      <Routes>
        <Route path="/initialize-model" element={<ModelInitializationPage />} />
        <Route path="/visualizer" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>);
    fireEvent.change(screen.getByLabelText("PERSON name (required)"), { target: { value: "Person" } });
    fireEvent.change(screen.getByLabelText("Birth date (required)"), { target: { value: "2000-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Review model" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm and create model" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Database temporarily unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Retry opening visualizer" }));
    expect(await screen.findByTestId("location")).toHaveTextContent("/visualizer");
    expect(api.createPerson).toHaveBeenCalledTimes(1);
    expect(api.loadHasmModelDb).toHaveBeenCalledTimes(2);
  });
});
