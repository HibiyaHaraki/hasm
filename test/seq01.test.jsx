import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import AppBootGatePage from "../src/pages/AppBootGatePage";
import SelectModelPage from "../src/pages/SelectModelPage";
import * as api from "../src/features/hasm/api";

vi.mock("../src/features/hasm/api", () => ({
  browseWorkspaceDirectory: vi.fn(),
  completeAppLaunch: vi.fn(),
  createHasmWorkspace: vi.fn(),
  createPerson: vi.fn(),
  createExperience: vi.fn(),
  createFact: vi.fn(),
  createLink: vi.fn(),
  loadHasmModelDb: vi.fn(),
  pickWorkspaceDirectory: vi.fn(),
  validateHasmMarkdownApp: vi.fn(),
  validateAppVersion: vi.fn(),
  switchWorkspaceCleanly: vi.fn(),
  validateHasmFolderPath: vi.fn(),
  withTimeout: vi.fn((promise) => promise),
  subscribeToTauriEvent: vi.fn(),
}));

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <output data-testid="location">{location.pathname}</output>
      <output data-testid="location-state">{JSON.stringify(location.state ?? null)}</output>
    </>
  );
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
  it.each(["C:\\workspace", "C:\\Life.hasm"])("TC-02-REACT-BROWSE-001 validates a browsed workspace %s before Open", async (path) => {
    api.browseWorkspaceDirectory.mockResolvedValue(path);
    api.validateHasmFolderPath.mockResolvedValue();
    renderSelect();
    fireEvent.click(screen.getByRole("button", { name: "Browse" }));
    await waitFor(() => expect(screen.getByLabelText("Workspace folder")).toHaveValue(path));
    await waitFor(() => expect(screen.getByRole("button", { name: "Open" })).toBeEnabled());
    expect(api.validateHasmFolderPath).toHaveBeenCalledWith(path);
    expect(api.createHasmWorkspace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByTestId("location")).toHaveTextContent("/loading-model");
  });
  it("TC-02-REACT-BROWSE-002 preserves the current valid path on cancel or same-folder selection", async () => {
    api.validateHasmFolderPath.mockResolvedValue();
    api.browseWorkspaceDirectory.mockResolvedValueOnce(null).mockResolvedValueOnce("C:\\Life.hasm");
    renderSelect();
    fireEvent.change(screen.getByLabelText("Workspace folder"), { target: { value: "C:\\Life.hasm" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Open" })).toBeEnabled());
    for (let selection = 0; selection < 2; selection += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Browse" }));
      await waitFor(() => expect(screen.getByRole("button", { name: "Browse" })).toBeEnabled());
      expect(screen.getByLabelText("Workspace folder")).toHaveValue("C:\\Life.hasm");
      expect(screen.getByRole("button", { name: "Open" })).toBeEnabled();
    }
    expect(api.validateHasmFolderPath).toHaveBeenCalledTimes(1);
  });
  it("TC-02-REACT-BROWSE-003 prevents duplicate dialogs and displays native errors", async () => {
    let rejectDialog;
    api.browseWorkspaceDirectory.mockReturnValue(new Promise((_resolve, reject) => { rejectDialog = reject; }));
    renderSelect();
    const browse = screen.getByRole("button", { name: "Browse" });
    fireEvent.click(browse);
    fireEvent.click(browse);
    expect(api.browseWorkspaceDirectory).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Browsing..." })).toBeDisabled();
    rejectDialog(new Error("Native dialog unavailable"));
    expect(await screen.findByRole("status")).toHaveTextContent("Native dialog unavailable");
    expect(screen.getByRole("button", { name: "Browse" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Open" })).toBeDisabled();
  });
  it("TC-02-REACT-BROWSE-004 invalidates an old valid path as soon as a new folder is selected", async () => {
    api.validateHasmFolderPath.mockResolvedValueOnce().mockRejectedValueOnce(new Error("Missing folder"));
    api.browseWorkspaceDirectory.mockResolvedValue("C:\\missing");
    renderSelect();
    fireEvent.change(screen.getByLabelText("Workspace folder"), { target: { value: "C:\\valid" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Open" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Browse" }));
    await waitFor(() => expect(screen.getByLabelText("Workspace folder")).toHaveValue("C:\\missing"));
    expect(screen.getByRole("button", { name: "Open" })).toBeDisabled();
    expect(await screen.findByText("Invalid HASM workspace folder.")).toBeInTheDocument();
  });
  it("TC-01-REACT-001 renders the initial loading state before IPC resolves", () => {
    api.validateHasmMarkdownApp.mockReturnValue(new Promise(() => {}));
    renderBoot();
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("HASM Markdown application")).toHaveAttribute("data-active", "true");
    expect(api.completeAppLaunch).not.toHaveBeenCalled();
  });

  it.each([
    ["select", () => {
      api.validateAppVersion.mockResolvedValue({ isModelSelected: false, path: null });
    }, "/select"],
    ["loading-model", () => {
      api.validateAppVersion.mockResolvedValue({ isModelSelected: true, path: "C:/workspace" });
      api.validateHasmFolderPath.mockResolvedValue();
    }, "/loading-model"],
    ["select-invalid-path", () => {
      api.validateAppVersion.mockResolvedValue({ isModelSelected: true, path: "C:/missing" });
      api.validateHasmFolderPath.mockRejectedValue(new Error("missing"));
    }, "/select"],
    ["error-app", () => {
      api.validateAppVersion.mockRejectedValue(new Error("Version inspection failed"));
    }, "/error-app"],
  ])("TC-01-REACT-015 reports splash handoff outcome %s once boot finishes", async (outcome, arrange, route) => {
    api.validateHasmMarkdownApp.mockResolvedValue();
    arrange();
    renderBoot();
    expect(await screen.findByTestId("location")).toHaveTextContent(route);
    await waitFor(() => expect(api.completeAppLaunch).toHaveBeenCalledWith(outcome));
    expect(api.completeAppLaunch).toHaveBeenCalledTimes(1);
  });

  it("TC-01-REACT-016 still navigates when the splash handoff report fails", async () => {
    api.validateHasmMarkdownApp.mockResolvedValue();
    api.validateAppVersion.mockResolvedValue({ isModelSelected: false, path: null });
    api.completeAppLaunch.mockRejectedValue(new Error("splash unavailable"));
    renderBoot();
    expect(await screen.findByTestId("location")).toHaveTextContent("/select");
    await waitFor(() => expect(api.completeAppLaunch).toHaveBeenCalledWith("select"));
  });

  it("TC-01-REACT-002 and TC-01-REACT-028 route a direct launch to selection without folder validation", async () => {
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

  it("TC-01-REACT-014 accepts a Windows Explorer quoted workspace path", async () => {
    api.validateHasmFolderPath.mockResolvedValue();
    renderSelect();
    fireEvent.change(screen.getByLabelText("Workspace folder"), { target: { value: '  "C:\\workspace with spaces"  ' } });

    await waitFor(() => expect(api.validateHasmFolderPath).toHaveBeenCalledWith("C:\\workspace with spaces"));
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByTestId("location")).toHaveTextContent("/loading-model");
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

  it("TC-01-REACT-017 aborts subsequent IPC and stores the error after a critical check failure", async () => {
    api.validateHasmMarkdownApp.mockRejectedValue(new Error("Markdown app missing"));
    renderBoot();
    expect(await screen.findByTestId("location")).toHaveTextContent("/error-app");
    expect(screen.getByTestId("location-state")).toHaveTextContent("Markdown app missing");
    expect(api.validateAppVersion).not.toHaveBeenCalled();
    expect(api.validateHasmFolderPath).not.toHaveBeenCalled();
  });

  it("TC-01-REACT-018 stores the Check 2 error and routes to the error page", async () => {
    api.validateHasmMarkdownApp.mockResolvedValue();
    api.validateAppVersion.mockRejectedValue(new Error("Version inspection failed"));
    renderBoot();
    expect(await screen.findByTestId("location")).toHaveTextContent("/error-app");
    expect(screen.getByTestId("location-state")).toHaveTextContent("Version inspection failed");
    expect(api.validateHasmFolderPath).not.toHaveBeenCalled();
  });

  it("TC-01-REACT-019 keeps the initial boot state intact when validation fails immediately", async () => {
    api.validateHasmMarkdownApp.mockRejectedValue(new Error("Markdown app missing"));
    renderBoot();
    // Initial mount state: isLoading=true, loadState=0, error=null, before the rejection routes away.
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("HASM Markdown application")).toHaveAttribute("data-active", "true");
    expect(screen.getByText("Application version and launch path")).toHaveAttribute("data-active", "false");
    expect(screen.queryByText("Markdown app missing")).not.toBeInTheDocument();
    expect(await screen.findByTestId("location")).toHaveTextContent("/error-app");
  });

  it("TC-01-REACT-020 halts boot progress when version inspection fails", async () => {
    let rejectVersion;
    api.validateHasmMarkdownApp.mockResolvedValue();
    api.validateAppVersion.mockReturnValue(new Promise((_resolve, reject) => { rejectVersion = reject; }));
    renderBoot();
    // Check 1 success advanced loadState to 1; Check 2 is still pending.
    await waitFor(() => expect(screen.getByText("Application version and launch path")).toHaveAttribute("data-active", "true"));
    expect(screen.getByText("Workspace path")).toHaveAttribute("data-active", "false");
    expect(api.validateAppVersion).toHaveBeenCalledTimes(1);
    rejectVersion(new Error("Version inspection failed"));
    expect(await screen.findByTestId("location")).toHaveTextContent("/error-app");
    expect(api.validateHasmFolderPath).not.toHaveBeenCalled();
  });

  it("TC-01-REACT-021 never navigates to loading-model with an unverified CLI path", async () => {
    api.validateHasmMarkdownApp.mockResolvedValue();
    api.validateAppVersion.mockResolvedValue({ isModelSelected: true, path: "C:/missing" });
    api.validateHasmFolderPath.mockRejectedValue(new Error("missing"));
    renderBoot();
    expect(await screen.findByTestId("location")).toHaveTextContent("/select");
    expect(screen.getByTestId("location")).not.toHaveTextContent("/loading-model");
    // The stored CLI path reached Check 3 but was never transferred as verified route state.
    expect(api.validateHasmFolderPath).toHaveBeenCalledWith("C:/missing");
    expect(screen.getByTestId("location-state")).toHaveTextContent("Specified HASM path does not exist.");
  });

  it("TC-01-REACT-022 gracefully falls back to select carrying the stored CLI path error", async () => {
    api.validateHasmMarkdownApp.mockResolvedValue();
    api.validateAppVersion.mockResolvedValue({ isModelSelected: true, path: "C:/missing" });
    api.validateHasmFolderPath.mockRejectedValue(new Error("missing"));
    renderBoot();
    // Fallback reaches /select (isModelSelected reset, manual flow active, no /error-app)
    // with the documented error message stored in route state.
    expect(await screen.findByTestId("location")).toHaveTextContent("/select");
    expect(screen.getByTestId("location-state")).toHaveTextContent("Specified HASM path does not exist.");
    await waitFor(() => expect(api.completeAppLaunch).toHaveBeenCalledWith("select-invalid-path"));
  });

  it("TC-01-REACT-023 wires hard timeouts on every boot IPC call", async () => {
    api.validateHasmMarkdownApp.mockResolvedValue();
    api.validateAppVersion.mockResolvedValue({ isModelSelected: true, path: "C:/workspace" });
    api.validateHasmFolderPath.mockResolvedValue();
    renderBoot();
    expect(await screen.findByTestId("location")).toHaveTextContent("/loading-model");
    // Check 1 (5,000ms), Check 2 (5,000ms), Check 3 (3,000ms) all run under withTimeout.
    expect(api.withTimeout.mock.calls.map((call) => call[1])).toEqual([5000, 5000, 3000]);
  });

  it("TC-01-REACT-024 wires the 2,000ms hard timeout on real-time path validation", async () => {
    api.validateHasmFolderPath.mockResolvedValue();
    renderSelect();
    fireEvent.change(screen.getByLabelText("Workspace folder"), { target: { value: "C:/workspace" } });
    await waitFor(() => expect(api.withTimeout).toHaveBeenCalled());
    expect(api.withTimeout.mock.calls[0][1]).toBe(2000);
    await waitFor(() => expect(screen.getByRole("button", { name: "Open" })).toBeEnabled());
  });

  it("TC-01-REACT-025 suppresses a keystroke storm until the 300ms debounce elapses", async () => {
    vi.useFakeTimers();
    try {
      api.validateHasmFolderPath.mockResolvedValue();
      renderSelect();
      const input = screen.getByLabelText("Workspace folder");
      for (let keystroke = 0; keystroke < 10; keystroke += 1) {
        if (keystroke > 0) act(() => vi.advanceTimersByTime(10));
        fireEvent.change(input, { target: { value: `C:/workspace${keystroke}` } });
      }
      // Earlier debounce timers were cancelled; the last one has not fired at 299ms.
      act(() => vi.advanceTimersByTime(299));
      expect(api.validateHasmFolderPath).not.toHaveBeenCalled();
      await act(async () => { vi.advanceTimersByTime(1); });
      expect(api.validateHasmFolderPath).toHaveBeenCalledTimes(1);
      expect(api.validateHasmFolderPath).toHaveBeenCalledWith("C:/workspace9");
    } finally {
      vi.useRealTimers();
    }
  });

  it("TC-01-REACT-026 keeps an unmatched quote literal in manual path input", async () => {
    api.validateHasmFolderPath.mockRejectedValue(new Error("ERR_TARGET_PATH_NOT_FOUND"));
    renderSelect();
    fireEvent.change(screen.getByLabelText("Workspace folder"), { target: { value: '  "C:\\unclosed  ' } });
    await waitFor(() => expect(api.validateHasmFolderPath).toHaveBeenCalledWith('"C:\\unclosed'));
    expect(await screen.findByText("Invalid HASM workspace folder.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open" })).toBeDisabled();
  });

  it("TC-01-REACT-027 recovers from an invalid path: warning shows then clears and submit enables", async () => {
    api.validateHasmFolderPath
      .mockRejectedValueOnce(new Error("ERR_TARGET_PATH_NOT_FOUND"))
      .mockResolvedValueOnce();
    renderSelect();
    const input = screen.getByLabelText("Workspace folder");
    fireEvent.change(input, { target: { value: "C:/missing" } });
    expect(await screen.findByText("Invalid HASM workspace folder.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open" })).toBeDisabled();
    fireEvent.change(input, { target: { value: "C:/workspace" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Open" })).toBeEnabled());
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("does not offer a test graph action", () => {
    renderSelect();
    expect(screen.queryByRole("button", { name: "Test 3D commit graph" })).not.toBeInTheDocument();
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