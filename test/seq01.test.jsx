import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import AppBootGatePage from "../src/pages/AppBootGatePage";
import SelectModelPage from "../src/pages/SelectModelPage";
import * as api from "../src/features/hasm/api";

vi.mock("../src/features/hasm/api", () => ({
  validateHasmMarkdownApp: vi.fn(),
  validateAppVersion: vi.fn(),
  validateHasmFolderPath: vi.fn(),
  withTimeout: (promise) => promise,
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

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("SEQ-01 app launch validation", () => {
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

  it("TC-01-REACT-003 and TC-01-REACT-005 debounce validation then submit once", async () => {
    api.validateHasmFolderPath.mockResolvedValue();
    render(
      <MemoryRouter initialEntries={["/select"]}>
        <Routes>
          <Route path="/select" element={<SelectModelPage />} />
          <Route path="/loading-model" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    const input = screen.getByLabelText("Workspace folder");
    fireEvent.change(input, { target: { value: "C:/a" } });
    fireEvent.change(input, { target: { value: "C:/workspace" } });
    await waitFor(() => expect(api.validateHasmFolderPath).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Open" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByTestId("location")).toHaveTextContent("/loading-model");
  });
});