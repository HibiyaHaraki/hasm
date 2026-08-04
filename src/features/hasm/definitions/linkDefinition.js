// ###################################################
// File Name : linkDefinition.js
// Author : Hibiya Haraki
// Date : August 2026
// ###################################################
// Purpose : LINK form schema and converters
// Description : Maps LINK detail payloads to editable and savable shapes.
// ###################################################

import { normalizeLines } from "./helpers";

export const linkFieldSet = [
  { key: "linkId", label: "Link ID", readOnly: true },
  { key: "linkName", label: "Link Name" },
  { key: "linkType", label: "Link Type" },
  {
    key: "linkDescriptionPath",
    label: "Description Path",
    readOnly: true,
    className: "full-width",
  },
  {
    key: "relatedIdsText",
    label: "Related IDs",
    multiline: true,
    placeholder: "One related UUID per line",
    className: "full-width",
  },
];

export function toLinkEditableDetail(detail) {
  if (!detail) {
    return null;
  }

  return {
    ...detail,
    relatedIdsText: (detail.relatedIds || []).join("\n"),
  };
}

export function toLinkSavePayload(draft) {
  return {
    ...draft,
    relatedIds: normalizeLines(draft.relatedIdsText || ""),
  };
}