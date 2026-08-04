// ###################################################
// File Name : index.js
// Author : Hibiya Haraki
// Date : August 2026
// ###################################################
// Purpose : Registry for all HASM entity definitions
// Description : Aggregates field sets and conversion handlers per entity type.
// ###################################################

import {
  experienceFieldSet,
  toExperienceEditableDetail,
  toExperienceSavePayload,
} from "./experienceDefinition";
import { factFieldSet, toFactEditableDetail, toFactSavePayload } from "./factDefinition";
import { linkFieldSet, toLinkEditableDetail, toLinkSavePayload } from "./linkDefinition";
import {
  personFieldSet,
  toPersonEditableDetail,
  toPersonSavePayload,
} from "./personDefinition";

export const ENTITY_DEFINITIONS = {
  PERSON: {
    title: "Person",
    fieldSet: personFieldSet,
    toEditableDetail: toPersonEditableDetail,
    toSavePayload: toPersonSavePayload,
  },
  EXPERIENCE: {
    title: "Experience",
    fieldSet: experienceFieldSet,
    toEditableDetail: toExperienceEditableDetail,
    toSavePayload: toExperienceSavePayload,
  },
  FACT: {
    title: "Fact",
    fieldSet: factFieldSet,
    toEditableDetail: toFactEditableDetail,
    toSavePayload: toFactSavePayload,
  },
  LINK: {
    title: "Link",
    fieldSet: linkFieldSet,
    toEditableDetail: toLinkEditableDetail,
    toSavePayload: toLinkSavePayload,
  },
};