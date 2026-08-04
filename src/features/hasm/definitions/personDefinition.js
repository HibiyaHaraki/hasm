// ###################################################
// File Name : personDefinition.js
// Author : Hibiya Haraki
// Date : August 2026
// ###################################################
// Purpose : PERSON form schema and converters
// Description : Maps PERSON detail payloads to editable and savable shapes.
// ###################################################

import { normalizeLines } from "./helpers";

export const personFieldSet = [
  { key: "personId", label: "Person ID", readOnly: true },
  { key: "personName", label: "Person Name" },
  { key: "birthday", label: "Birthday", placeholder: "YYYY-MM-DD" },
  { key: "die", label: "Die", placeholder: "YYYY-MM-DD" },
  {
    key: "personDescriptionPath",
    label: "Description Path",
    readOnly: true,
    className: "full-width",
  },
  {
    key: "linkIdsText",
    label: "Link IDs",
    multiline: true,
    placeholder: "One LINK UUID per line",
    className: "full-width",
  },
];

export function toPersonEditableDetail(detail) {
  if (!detail) {
    return null;
  }

  return {
    ...detail,
    linkIdsText: (detail.linkIds || []).join("\n"),
  };
}

export function toPersonSavePayload(draft) {
  return {
    ...draft,
    linkIds: normalizeLines(draft.linkIdsText || ""),
  };
}