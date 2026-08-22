export const DEFAULT_LAYOUT_FILTER = {
  timeScaleMode: "Linear",
  zScaleFactor: 1,
};

export const TIME_SCALE_MODES = ["Linear", "Logarithmic", "SequentialIndex"];

export function nextLayoutFilter(filter, property, value) {
  return { ...filter, [property]: property === "zScaleFactor" ? Number(value) : value };
}