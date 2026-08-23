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
  subscribeToTauriEvent: vi.fn(),
}));
vi.mock("../src/features/visualizer/threeCommitGraph", () => ({
  createCommitGraph: vi.fn(() => () => {}),
}));

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

  it("TC-08-REACT-004 initializes an empty model with minimum required input", async () => {
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

    fireEvent.change(screen.getByLabelText("PERSON name (required)"), { target: { value: "Bootstrap" } });
    fireEvent.click(screen.getByRole("button", { name: "Initialize and Open Visualizer" }));

    await vi.waitFor(() =>
      expect(api.createPerson).toHaveBeenCalledWith("C:/fixture.hasm", expect.objectContaining({ personName: "Bootstrap" })),
    );
    expect(await screen.findByTestId("location")).toHaveTextContent("/visualizer");
  });
});
