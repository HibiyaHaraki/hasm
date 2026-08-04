// ###################################################
// File Name : helpers.js
// Author : Hibiya Haraki
// Date : August 2026
// ###################################################
// Purpose : Utility helpers for entity detail transformations
// Description : Contains text-list normalization helpers used by definitions.
// ###################################################

export function normalizeLines(value) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}