import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import GlobalNavbar from "../src/features/navigation/GlobalNavbar";
import ProtectedRoute from "../src/features/navigation/ProtectedRoute";
import SelectModelPage from "../src/pages/SelectModelPage";
import VisualizerPage from "../src/pages/VisualizerPage";
import { ThemeProvider } from "../src/features/theme/ThemeContext";
import {
  COLOR_PATTERNS,
  DEFAULT_COLOR_PATTERN,
  getPatternById,
  getThemeVariables,
  isValidColorPattern,
} from "../src/hasm_color_pattern/src/index.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const navbarCss = readFileSync(resolve("src", "features", "navigation", "GlobalNavbar.css"), "utf8");
const bootstrapCss = readFileSync(resolve("node_modules", "bootstrap", "dist", "css", "bootstrap.min.css"), "utf8");
const appCss = readFileSync(resolve("src", "App.css"), "utf8");

const api = vi.hoisted(() => ({
  switchWorkspaceCleanly: vi.fn(),
  subscribeToTauriEvent: vi.fn(),
  computeVisualizerLayout: vi.fn(),
}));
vi.mock("../src/features/hasm/api", () => api);

// Stub for the hasm_visualizer submodule so SEQ-07 theme tests observe the exact
// colorPattern contract the host passes without creating a WebGL scene (REQ-07-FUNC-302).
const visualizerStub = vi.hoisted(() => ({ mounts: 0, unmounts: 0 }));
vi.mock("../src/hasm_visualizer/HasmVisualizerComponent.jsx", async () => {
  const { useEffect } = await import("react");
  return {
    default: function HasmVisualizerStub({ colorPattern }) {
      useEffect(() => {
        visualizerStub.mounts += 1;
        return () => {
          visualizerStub.unmounts += 1;
        };
      }, []);
      return <div data-testid="visualizer-stub" data-color-pattern={colorPattern} />;
    },
  };
});

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function StateProbe() {
  const location = useLocation();
  return (
    <output data-testid="state">
      {JSON.stringify({ pathname: location.pathname, state: location.state })}
    </output>
  );
}

// Drives a location.state change (as save/repair flows do) so GlobalNavbar
// reactivity can be observed without IPC (REQ-07-FUNC-402 / REQ-07-FUNC-403).
function StateDriver({ label, next }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate("/visualizer", { state: next })}>
      {label}
    </button>
  );
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

  it("TC-07-NAV-CONTRAST-001 keeps actual menu text readable against its surfaces in every palette", () => {
    const styles = [navbarCss, bootstrapCss, appCss].map(() => {
      const style = document.createElement("style");
      document.head.appendChild(style);
      return style;
    });
    try {
      render(<MemoryRouter initialEntries={["/select"]}>
        <ThemeProvider value={{ activePatternId: "classic", setActivePatternId: vi.fn() }}>
          <GlobalNavbar />
        </ThemeProvider>
      </MemoryRouter>);
      const rgb = (color) => {
        const values = color.match(/[\d.]+/g)?.map(Number);
        expect(values?.length, `Unresolved CSS color: ${color}`).toBeGreaterThanOrEqual(3);
        return values.slice(0, 3);
      };
      const composite = (color, background) => {
        const values = color.match(/[\d.]+/g)?.map(Number);
        expect(values?.length, `Unresolved CSS color: ${color}`).toBeGreaterThanOrEqual(3);
        const alpha = values[3] ?? 1;
        const under = rgb(background);
        return `rgb(${values.slice(0, 3).map((value, index) => Math.round(value * alpha + under[index] * (1 - alpha))).join(", ")})`;
      };
      const luminance = (color) => {
        const [r, g, b] = rgb(color).map((value) => {
          const channel = value / 255;
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const contrast = (foreground, background) => {
        const values = [luminance(foreground), luminance(background)];
        return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
      };
      for (const pattern of COLOR_PATTERNS) {
        const variables = getThemeVariables(pattern.id);
        [navbarCss, bootstrapCss, appCss].forEach((css, index) => {
          styles[index].textContent = css.replace(/var\((--theme-[\w-]+)\)/g, (original, name) => variables[name] ?? original);
        });
        const navbar = screen.getByRole("navigation");
        const background = getComputedStyle(navbar).backgroundColor;
        const backgroundAlpha = background.match(/[\d.]+/g)?.map(Number)[3] ?? 1;
        expect(backgroundAlpha, `${pattern.id} navbar background opacity`).toBe(1);
        for (const selector of [".global-navbar-brand", ".status-chip", ".theme-inline-label", ".global-navbar-theme-select", ".btn-hasm-outline"]) {
          for (const element of navbar.querySelectorAll(selector)) {
            const elementStyle = getComputedStyle(element);
            const surface = composite(elementStyle.backgroundColor, background);
            const foreground = composite(elementStyle.color, surface);
            expect(contrast(foreground, surface), `${pattern.id} ${selector}`).toBeGreaterThanOrEqual(4.5);
          }
        }
      }
    } finally {
      styles.forEach((style) => style.remove());
    }
  });

  it("TC-07-REACT-007 rejects direct protected access without a workspace and carries the warning payload", async () => {
    render(
      <MemoryRouter initialEntries={["/entity-detail/FACT/1234"]}>
        <Routes>
          <Route element={<ProtectedRoute requireVerified={true} />}>
            <Route path="/entity-detail/:entityType/:entityId" element={<div>Ticket</div>} />
          </Route>
          <Route path="/select" element={<StateProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    const probe = JSON.parse((await screen.findByTestId("state")).textContent);
    expect(screen.queryByText("Ticket")).toBeNull();
    expect(probe.pathname).toBe("/select");
    expect(probe.state).toMatchObject({
      from: "/entity-detail/FACT/1234",
      redirectReason: "HASMモデルが選択されていません。先にワークスペースを選択してください。",
      redirectType: "warning",
    });
  });

  it("TC-07-REACT-008 rejects unverified protected access and redirects to /loading-model with the info payload", async () => {
    window.sessionStorage.setItem("hasm-active-workspace", "C:/demo.hasm");

    render(
      <MemoryRouter initialEntries={[{ pathname: "/visualizer", state: { isVerified: false } }]}>
        <Routes>
          <Route element={<ProtectedRoute requireVerified={true} />}>
            <Route path="/visualizer" element={<div>Visualizer</div>} />
          </Route>
          <Route path="/loading-model" element={<StateProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    const probe = JSON.parse((await screen.findByTestId("state")).textContent);
    expect(screen.queryByText("Visualizer")).toBeNull();
    expect(probe.pathname).toBe("/loading-model");
    expect(probe.state).toMatchObject({
      path: "C:/demo.hasm",
      returnTo: "/visualizer",
      redirectReason: "Reloading and verifying the workspace before returning to visualization.",
      redirectType: "info",
    });
  });

  it("TC-07-REACT-004 renders no redirect notice when router state carries no reason (refresh after clearance)", () => {
    render(
      <MemoryRouter initialEntries={["/select"]}>
        <Routes>
          <Route path="/select" element={<SelectModelPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("status").textContent).toBe("");
    expect(
      screen.queryByText("HASMモデルが選択されていません。先にワークスペースを選択してください。"),
    ).toBeNull();
  });

  it("TC-07-REACT-009 renders the unloaded navbar state synchronously with zero IPC calls", () => {
    render(
      <MemoryRouter initialEntries={["/select"]}>
        <ThemeProvider value={{ activePatternId: "classic", setActivePatternId: vi.fn() }}>
          <GlobalNavbar />
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Workspace:/)).toHaveTextContent("No workspace selected");
    expect(screen.getByText(/Status:/)).toHaveTextContent("Unloaded");
    expect(screen.getByText(/Warnings:/)).toHaveTextContent("0");
    for (const mocked of Object.values(api)) {
      expect(mocked).not.toHaveBeenCalled();
    }
  });

  it("TC-07-REACT-010 skips the switch IPC when no workspace is active and still resets to /select", async () => {
    render(
      <MemoryRouter initialEntries={["/visualizer"]}>
        <ThemeProvider value={{ activePatternId: "classic", setActivePatternId: vi.fn() }}>
          <GlobalNavbar />
          <Routes>
            <Route path="/visualizer" element={<div>Host</div>} />
            <Route path="/select" element={<LocationProbe />} />
          </Routes>
        </ThemeProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Switch Model" }));

    expect(await screen.findByTestId("location")).toHaveTextContent("/select");
    expect(api.switchWorkspaceCleanly).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem("hasm-active-workspace")).toBeNull();
    expect(window.sessionStorage.getItem("hasm-workspace-read-only")).toBeNull();
  });

  it("TC-07-REACT-011 updates status badges when verification is invalidated and repaired warnings clear", () => {
    window.sessionStorage.setItem("hasm-active-workspace", "C:/demo.hasm");
    window.sessionStorage.setItem("hasm-workspace-read-only", "false");
    const model = { people: [] };

    render(
      <MemoryRouter
        initialEntries={[{ pathname: "/visualizer", state: { model, isVerified: true, warnings: ["w1", "w2"] } }]}
      >
        <ThemeProvider value={{ activePatternId: "classic", setActivePatternId: vi.fn() }}>
          <GlobalNavbar />
          <Routes>
            <Route
              path="/visualizer"
              element={
                <>
                  <StateDriver label="save-metadata" next={{ model, isVerified: false, warnings: ["w1", "w2"] }} />
                  <StateDriver label="repair-folders" next={{ model, isVerified: false, warnings: [] }} />
                </>
              }
            />
          </Routes>
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Status:/)).toHaveTextContent("Ready");
    expect(screen.getByText(/Warnings:/)).toHaveTextContent("2");

    fireEvent.click(screen.getByRole("button", { name: "save-metadata" }));
    expect(screen.getByText(/Status:/)).toHaveTextContent("Needs Verify");

    fireEvent.click(screen.getByRole("button", { name: "repair-folders" }));
    expect(screen.getByText(/Warnings:/)).toHaveTextContent("0");
    expect(api.switchWorkspaceCleanly).not.toHaveBeenCalled();
  });

  it("TC-07-REACT-012 never shows Ready for an invalidated model and keeps unrepaired warnings", () => {
    window.sessionStorage.setItem("hasm-active-workspace", "C:/demo.hasm");
    window.sessionStorage.setItem("hasm-workspace-read-only", "false");

    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/visualizer", state: { model: { people: [] }, isVerified: false, warnings: ["w1", "w2"] } },
        ]}
      >
        <ThemeProvider value={{ activePatternId: "classic", setActivePatternId: vi.fn() }}>
          <GlobalNavbar />
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Status:/)).toHaveTextContent("Needs Verify");
    expect(screen.getByText(/Status:/)).not.toHaveTextContent("Ready");
    expect(screen.getByText(/Warnings:/)).toHaveTextContent("2");
    expect(screen.getByText(/Warnings:/)).not.toHaveTextContent("0");
  });

  function renderVisualizerHost(activePatternId) {
    return (
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/visualizer",
            state: { path: "C:/demo.hasm", model: { people: [], facts: [] }, isVerified: true },
          },
        ]}
      >
        <ThemeProvider value={{ activePatternId, setActivePatternId: vi.fn() }}>
          <Routes>
            <Route path="/visualizer" element={<VisualizerPage />} />
          </Routes>
        </ThemeProvider>
      </MemoryRouter>
    );
  }

  it("TC-07-REACT-013 forwards theme palette changes to the mounted 3D visualizer", async () => {
    visualizerStub.mounts = 0;
    visualizerStub.unmounts = 0;
    api.subscribeToTauriEvent.mockResolvedValue(() => {});
    window.sessionStorage.setItem("hasm-active-workspace", "C:/demo.hasm");

    const view = render(renderVisualizerHost("classic"));
    expect(await screen.findByTestId("visualizer-stub")).toHaveAttribute("data-color-pattern", "classic");

    view.rerender(renderVisualizerHost("ocean"));
    expect(screen.getByTestId("visualizer-stub")).toHaveAttribute("data-color-pattern", "ocean");
  });

  it("TC-07-REACT-014 does not re-create the visualizer host or issue layout IPC on theme change", async () => {
    visualizerStub.mounts = 0;
    visualizerStub.unmounts = 0;
    api.subscribeToTauriEvent.mockResolvedValue(() => {});
    window.sessionStorage.setItem("hasm-active-workspace", "C:/demo.hasm");

    const view = render(renderVisualizerHost("classic"));
    await screen.findByTestId("visualizer-stub");

    view.rerender(renderVisualizerHost("forest"));

    expect(visualizerStub.mounts).toBe(1);
    expect(visualizerStub.unmounts).toBe(0);
    expect(api.computeVisualizerLayout).not.toHaveBeenCalled();
  });

  it("TC-07-REACT-015 falls back to the default palette for an unknown pattern id", () => {
    expect(isValidColorPattern("not-a-real-pattern")).toBe(false);
    expect(getPatternById("not-a-real-pattern").id).toBe(DEFAULT_COLOR_PATTERN);
    expect(getThemeVariables("not-a-real-pattern")).toEqual(getThemeVariables(DEFAULT_COLOR_PATTERN));
    expect(getThemeVariables("not-a-real-pattern")["--theme-primary"]).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("TC-07-REACT-016 exposes a complete palette contract for every preset", () => {
    const HEX = /^#[0-9a-f]{6}$/i;
    const seen = new Set();
    expect(COLOR_PATTERNS.length).toBeGreaterThan(0);
    for (const pattern of COLOR_PATTERNS) {
      expect(pattern.id).toMatch(/^[a-z0-9-]+$/);
      expect(seen.has(pattern.id)).toBe(false);
      seen.add(pattern.id);
      expect(typeof pattern.label).toBe("string");
      const variables = getThemeVariables(pattern.id);
      expect(variables["--theme-primary"]).toMatch(HEX);
      expect(variables["--theme-secondary"]).toMatch(HEX);
      expect(variables["--theme-on-accent"]).toMatch(HEX);
    }
  });

  it("TC-07-REACT-017 rejects unreadable on-accent tokens and translucent dialog surfaces in every pattern", () => {
    const HEX = /^#[0-9a-f]{6}$/i;
    const luminance = (hex) => {
      const channels = [1, 3, 5].map((start) => {
        const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const contrast = (first, second) => {
      const lighter = Math.max(luminance(first), luminance(second));
      const darker = Math.min(luminance(first), luminance(second));
      return (lighter + 0.05) / (darker + 0.05);
    };

    for (const pattern of COLOR_PATTERNS) {
      const variables = getThemeVariables(pattern.id);
      // Dialog surfaces must stay opaque hex colors so body-portal modals never go see-through.
      expect(variables["--theme-surface"]).toMatch(HEX);
      // A dark accent must never be reused as foreground on itself (REQ-07-RULE-006).
      expect(variables["--theme-on-accent"]).not.toBe(variables["--theme-primary"]);
      expect(contrast(variables["--theme-on-accent"], variables["--theme-primary"])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(variables["--theme-text"], variables["--theme-surface"])).toBeGreaterThanOrEqual(4.5);
    }
  });
});
