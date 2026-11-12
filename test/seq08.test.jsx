import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  it("TC-08-REACT-LINK-001 includes URL arrays in all four creation payloads", async () => {
    for (const [type, create] of [["PERSON", api.createPerson], ["EXPERIENCE", api.createExperience], ["FACT", api.createFact], ["LINK", api.createLink]]) {
      create.mockResolvedValue({});
      api.loadHasmModelDb.mockResolvedValue(model);
      render(<MemoryRouter initialEntries={[{ pathname: "/entity-create", state: { model, path: "C:/fixture.hasm" } }]}>
        <Routes><Route path="/entity-create" element={<EntityCreatePage />} /><Route path="/visualizer" element={<LocationProbe />} /></Routes>
      </MemoryRouter>);
      fireEvent.click(screen.getByRole("button", { name: type }));
      fireEvent.click(screen.getByRole("button", { name: "Add link" }));
      fireEvent.change(screen.getByLabelText("Link 1"), { target: { value: "https://example.org/source" } });
      fireEvent.click(screen.getByRole("button", { name: `Create ${type}` }));
      await vi.waitFor(() => expect(create).toHaveBeenCalledWith("C:/fixture.hasm", expect.objectContaining({ link: ["https://example.org/source"] })));
      await screen.findByTestId("location");
      cleanup(); vi.resetAllMocks();
    }
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
