// ###################################################
// File Name : factDefinition.js
// Author : Hibiya Haraki
// Date : August 2026
// ###################################################
// Purpose : FACT form schema and converters
// Description : Maps FACT detail payloads to editable and savable shapes.
// ###################################################

import { normalizeLines } from "./helpers";

export const factFieldSet = [
  { key: "factId", label: "Fact ID", readOnly: true },
  {
    key: "factDescriptionPath",
    label: "Description Path",
    readOnly: true,
    className: "full-width",
  },
  {
    key: "branchExperienceIdsText",
    label: "Branch Experience IDs",
    multiline: true,
    placeholder: "One EXPERIENCE UUID per line",
  },
  {
    key: "personIdsText",
    label: "Person IDs",
    multiline: true,
    placeholder: "One PERSON UUID per line",
  },
  {
    key: "linkIdsText",
    label: "Link IDs",
    multiline: true,
    placeholder: "One LINK UUID per line",
  },
];

export function toFactEditableDetail(detail) {
  if (!detail) {
    return null;
  }

  return {
    ...detail,
    branchExperienceIdsText: (detail.branchExperienceIds || []).join("\n"),
    personIdsText: (detail.personIds || []).join("\n"),
    linkIdsText: (detail.linkIds || []).join("\n"),
  };
}

export function toFactSavePayload(draft) {
  return {
    ...draft,
    branchExperienceIds: normalizeLines(draft.branchExperienceIdsText || ""),
    personIds: normalizeLines(draft.personIdsText || ""),
    linkIds: normalizeLines(draft.linkIdsText || ""),
  };
}