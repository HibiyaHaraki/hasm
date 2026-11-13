import { createContext, useContext } from "react";
import { DEFAULT_COLOR_PATTERN } from "../../hasm_color_pattern/src/index.js";

const ThemeContext = createContext({
  activePatternId: DEFAULT_COLOR_PATTERN,
  setActivePatternId: () => {},
});

// [SEQ-MD-07][REQ-07-RULE-005][REQ-07-FUNC-301] Provides the active color pattern id and setter so theme
// selection updates document CSS variables and theme-aware consumers immediately.
export function ThemeProvider({ value, children }) {
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// [REQ-07-FUNC-301][REQ-07-FUNC-302] Reads the active theme pattern for pages and the 3D visualizer host.
export function useTheme() {
  return useContext(ThemeContext);
}
