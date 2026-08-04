// ###################################################
// File Name : experienceDefinition.js
// Author : Hibiya Haraki
// Date : August 2026
// ###################################################
// Purpose : EXPERIENCE form schema and converters
// Description : Maps EXPERIENCE detail payloads to editable and savable shapes.
// ###################################################

import { normalizeLines } from "./helpers";

export const experienceFieldSet = [
  { key: "experienceId", label: "Experience ID", readOnly: true },
  { key: "experienceName", label: "Experience Name" },
  { key: "personId", label: "Owner Person ID" },
  {
    key: "experienceDescriptionPath",
    label: "Description Path",
    readOnly: true,
    className: "full-width",
  },
  {
    key: "parentExperienceIdsText",
    label: "Parent Experience IDs",
    multiline: true,
    placeholder: "One EXPERIENCE UUID per line",
  },
  {
    key: "linkIdsText",
    label: "Link IDs",
    multiline: true,
    placeholder: "One LINK UUID per line",
  },
];

export function toExperienceEditableDetail(detail) {
  if (!detail) {
    return null;
  }

  return {
    ...detail,
    parentExperienceIdsText: (detail.parentExperienceIds || []).join("\n"),
    linkIdsText: (detail.linkIds || []).join("\n"),
  };
}

export function toExperienceSavePayload(draft) {
  return {
    ...draft,
    parentExperienceIds: normalizeLines(draft.parentExperienceIdsText || ""),
    linkIds: normalizeLines(draft.linkIdsText || ""),
  };
}