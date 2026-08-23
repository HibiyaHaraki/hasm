import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import GlobalNavbar from "../src/features/navigation/GlobalNavbar";
import ProtectedRoute from "../src/features/navigation/ProtectedRoute";
import SelectModelPage from "../src/pages/SelectModelPage";
import { ThemeProvider } from "../src/features/theme/ThemeContext";

const api = vi.hoisted(() => ({ switchWorkspaceCleanly: vi.fn() }));
vi.mock("../src/features/hasm/api", () => api);

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  window.sessionStorage.clear();
});

describe("SEQ-07 global navigation and status", () => {
  it("TC-07-REACT-001 redirects protected route to /select when no workspace is active", async () => {
    render(
      <MemoryRouter initialEntries={["/visualizer"]}>
        <Routes>
          <Route element={<ProtectedRoute requireVerified={true} />}>
            <Route path="/visualizer" element={<div>Visualizer</div>} />
          </Route>
          <Route path="/select" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId("location")).toHaveTextContent("/select");
  });

  it("TC-07-REACT-003 shows redirect reason on select page and clears route state", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/select",
            state: { redirectReason: "HASMモデルが選択されていません。先にワークスペースを選択してください。" },
          },
        ]}
      >
        <Routes>
          <Route path="/select" element={<SelectModelPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("HASMモデルが選択されていません。先にワークスペースを選択してください。")).toBeInTheDocument();
    await vi.waitFor(() => expect(window.history.state?.usr?.redirectReason).toBeUndefined());
  });

  it("TC-07-REACT-005 shows workspace path and status in global menu", async () => {
    window.sessionStorage.setItem("hasm-active-workspace", "C:/demo.hasm");
    window.sessionStorage.setItem("hasm-workspace-read-only", "false");

    render(
      <MemoryRouter initialEntries={[{ pathname: "/visualizer", state: { model: { people: [] }, isVerified: true, warnings: ["warn"] } }]}>
        <ThemeProvider value={{ activePatternId: "classic", setActivePatternId: vi.fn() }}>
          <GlobalNavbar />
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Workspace:/)).toHaveTextContent("C:/demo.hasm");
    expect(screen.getByText(/Status:/)).toHaveTextContent("Ready");
    expect(screen.getByText(/Warnings:/)).toHaveTextContent("1");
  });

  it("TC-07-E2E-005 switches model cleanly and navigates to /select", async () => {
    window.sessionStorage.setItem("hasm-active-workspace", "C:/demo.hasm");
    window.sessionStorage.setItem("hasm-workspace-read-only", "true");
    api.switchWorkspaceCleanly.mockResolvedValue({});

    render(
      <MemoryRouter initialEntries={[{ pathname: "/visualizer", state: { model: { people: [] }, isVerified: true } }]}>
        <ThemeProvider value={{ activePatternId: "classic", setActivePatternId: vi.fn() }}>
          <GlobalNavbar />
          <Routes>
            <Route path="/select" element={<LocationProbe />} />
          </Routes>
        </ThemeProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Switch Model" }));

    await vi.waitFor(() => expect(api.switchWorkspaceCleanly).toHaveBeenCalledWith("C:/demo.hasm", true));
    expect(await screen.findByTestId("location")).toHaveTextContent("/select");
  });

  it("TC-07-REACT-006 changes theme pattern from global menu", async () => {
    const setActivePatternId = vi.fn();

    render(
      <MemoryRouter initialEntries={["/select"]}>
        <ThemeProvider value={{ activePatternId: "classic", setActivePatternId }}>
          <GlobalNavbar />
        </ThemeProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Theme"), { target: { value: "ocean" } });
    expect(setActivePatternId).toHaveBeenCalledWith("ocean");
  });
});
