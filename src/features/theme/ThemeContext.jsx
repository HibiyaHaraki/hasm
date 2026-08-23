import { createContext, useContext } from "react";
import { DEFAULT_COLOR_PATTERN } from "../../hasm_color_pattern/src/index.js";

const ThemeContext = createContext({
  activePatternId: DEFAULT_COLOR_PATTERN,
  setActivePatternId: () => {},
});

export function ThemeProvider({ value, children }) {
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
