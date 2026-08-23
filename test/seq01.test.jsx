import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import AppBootGatePage from "../src/pages/AppBootGatePage";
import SelectModelPage from "../src/pages/SelectModelPage";
import * as api from "../src/features/hasm/api";

vi.mock("../src/features/hasm/api", () => ({
  createHasmWorkspace: vi.fn(),
  createPerson: vi.fn(),
  createExperience: vi.fn(),
  createFact: vi.fn(),
  createLink: vi.fn(),
  loadHasmModelDb: vi.fn(),
  pickWorkspaceDirectory: vi.fn(),
  validateHasmMarkdownApp: vi.fn(),
  validateAppVersion: vi.fn(),
  createVisualizerDemoWorkspace: vi.fn(),
  validateHasmFolderPath: vi.fn(),
  withTimeout: vi.fn((promise) => promise),
  subscribeToTauriEvent: vi.fn(),
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function renderBoot() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<AppBootGatePage />} />
        <Route path="/select" element={<LocationProbe />} />
        <Route path="/loading-model" element={<LocationProbe />} />
        <Route path="/error-app" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderSelect() {
  return render(
    <MemoryRouter initialEntries={["/select"]}>
      <Routes>
        <Route path="/select" element={<SelectModelPage />} />
        <Route path="/loading-model" element={<LocationProbe />} />
        <Route path="/visualizer" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("SEQ-01 app launch validation", () => {
  it("TC-01-REACT-001 renders the initial loading state before IPC resolves", () => {
    api.validateHasmMarkdownApp.mockReturnValue(new Promise(() => {}));
    renderBoot();
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("HASM Markdown application")).toHaveAttribute("data-active", "true");
  });

  it("TC-01-REACT-002 routes a direct launch to workspace selection", async () => {
    api.validateHasmMarkdownApp.mockResolvedValue();
    api.validateAppVersion.mockResolvedValue({ isModelSelected: false, path: null });
    renderBoot();
    expect(await screen.findByTestId("location")).toHaveTextContent("/select");
    expect(api.validateHasmFolderPath).not.toHaveBeenCalled();
  });

  it("TC-01-REACT-002 validates a CLI workspace before loading it", async () => {
    api.validateHasmMarkdownApp.mockResolvedValue();
    api.validateAppVersion.mockResolvedValue({ isModelSelected: true, path: "C:/workspace" });
    api.validateHasmFolderPath.mockResolvedValue();
    renderBoot();
    expect(await screen.findByTestId("location")).toHaveTextContent("/loading-model");
    expect(api.validateHasmFolderPath).toHaveBeenCalledWith("C:/workspace");
  });

  it("TC-01-REACT-007 routes an application validation failure to the error page", async () => {
    api.validateHasmMarkdownApp.mockRejectedValue(new Error("Markdown app missing"));
    renderBoot();
    expect(await screen.findByTestId("location")).toHaveTextContent("/error-app");
  });

  it("TC-01-REACT-006 routes a Markdown validation timeout to the error page", async () => {
    api.validateHasmMarkdownApp.mockReturnValue(new Promise(() => {}));
    api.withTimeout.mockRejectedValue(new Error("IPC call timed out"));
    renderBoot();
    expect(await screen.findByTestId("location")).toHaveTextContent("/error-app");
  });

  it("TC-01-REACT-008 routes a version inspection failure to the error page", async () => {
    api.validateHasmMarkdownApp.mockResolvedValue();
    api.validateAppVersion.mockRejectedValue(new Error("Version inspection failed"));
    renderBoot();
    expect(await screen.findByTestId("location")).toHaveTextContent("/error-app");
  });

  it("TC-01-REACT-009 and TC-01-REACT-010 fall back when a CLI path is invalid", async () => {
    api.validateHasmMarkdownApp.mockResolvedValue();
    api.validateAppVersion.mockResolvedValue({ isModelSelected: true, path: "C:/missing" });
    api.validateHasmFolderPath.mockRejectedValue(new Error("Specified HASM path does not exist"));
    renderBoot();
    expect(await screen.findByTestId("location")).toHaveTextContent("/select");
  });

  it("TC-01-REACT-003 and TC-01-REACT-005 debounce validation then submit once", async () => {
    api.validateHasmFolderPath.mockResolvedValue();
    renderSelect();
    const input = screen.getByLabelText("Workspace folder");
    fireEvent.change(input, { target: { value: "C:/a" } });
    fireEvent.change(input, { target: { value: "C:/workspace" } });
    await waitFor(() => expect(api.validateHasmFolderPath).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Open" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByTestId("location")).toHaveTextContent("/loading-model");
  });

  it("TC-01-REACT-004 enables a valid path and clears the warning", async () => {
    api.validateHasmFolderPath.mockResolvedValue();
    renderSelect();
    fireEvent.change(screen.getByLabelText("Workspace folder"), { target: { value: "C:/workspace" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Open" })).toBeEnabled());
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("TC-01-REACT-011 keeps submit disabled for an invalid path", async () => {
    api.validateHasmFolderPath.mockRejectedValue(new Error("ERR_TARGET_PATH_NOT_FOUND"));
    renderSelect();
    fireEvent.change(screen.getByLabelText("Workspace folder"), { target: { value: "C:/missing" } });
    expect(await screen.findByText("Invalid HASM workspace folder.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open" })).toBeDisabled();
  });

  it("TC-01-REACT-012 keeps submit disabled after validation timeout", async () => {
    api.validateHasmFolderPath.mockReturnValue(new Promise(() => {}));
    api.withTimeout.mockRejectedValue(new Error("Path verification timed out."));
    renderSelect();
    fireEvent.change(screen.getByLabelText("Workspace folder"), { target: { value: "C:/slow" } });
    expect(await screen.findByText("Path verification timed out.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open" })).toBeDisabled();
  });

  it("TC-01-REACT-013 ignores repeated submit events", async () => {
    api.validateHasmFolderPath.mockResolvedValue();
    renderSelect();
    fireEvent.change(screen.getByLabelText("Workspace folder"), { target: { value: "C:/workspace" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Open" })).toBeEnabled());
    const button = screen.getByRole("button", { name: "Open" });
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);
    expect(await screen.findByTestId("location")).toHaveTextContent("/loading-model");
  });

  it("TC-03-DEV-001 creates the populated visualizer demo and opens the graph", async () => {
    api.createVisualizerDemoWorkspace.mockResolvedValue({ path: "C:/demo.hasm", model: { people: [], experiences: [], facts: [], links: [] } });
    renderSelect();
    fireEvent.click(screen.getByRole("button", { name: "Test 3D commit graph" }));
    expect(await screen.findByTestId("location")).toHaveTextContent("/visualizer");
    expect(api.createVisualizerDemoWorkspace).toHaveBeenCalledTimes(1);
  });

  it("TC-08-E2E-001 creates a workspace and routes to loading-model", async () => {
    api.pickWorkspaceDirectory.mockResolvedValue("C:/NewLife.hasm");
    api.createHasmWorkspace.mockResolvedValue({ path: "C:/NewLife.hasm" });
    renderSelect();

    fireEvent.click(screen.getByRole("button", { name: "Create New HASM" }));

    expect(await screen.findByTestId("location")).toHaveTextContent("/loading-model");
    expect(api.createHasmWorkspace).toHaveBeenCalledWith("C:/NewLife.hasm");
  });
});