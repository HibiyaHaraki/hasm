// ###################################################
// File Name : api.js
// Author : Hibiya Haraki
// Date : August 2026
// ###################################################
// Purpose : Tauri command bridge for HASM frontend
// Description : Wraps invoke calls for open, read-detail, and save operations.
// ###################################################

import { invoke } from "@tauri-apps/api/core";

export function validateHasmMarkdownApp() {
  return invoke("validate_hasm_markdown_app");
}

export function validateAppVersion() {
  return invoke("validate_app_version");
}

export function validateHasmFolderPath(path) {
  return invoke("validate_hasm_folder_path", { path });
}

export function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

export function openHasmModel(modelRoot) {
  return invoke("open_hasm_model", { modelRoot });
}

export function getEntityDetail(entityType, modelRoot, entityId) {
  const commands = {
    PERSON: "get_person_detail",
    EXPERIENCE: "get_experience_detail",
    FACT: "get_fact_detail",
    LINK: "get_link_detail",
  };

  return invoke(commands[entityType], { modelRoot, entityId });
}

export function saveEntityDetail(entityType, modelRoot, detail) {
  const commands = {
    PERSON: "save_person_detail",
    EXPERIENCE: "save_experience_detail",
    FACT: "save_fact_detail",
    LINK: "save_link_detail",
  };

  return invoke(commands[entityType], { modelRoot, detail });
}