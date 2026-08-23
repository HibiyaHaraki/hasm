// ###################################################
// File Name : api.js
// Author : Hibiya Haraki
// Date : August 2026
// ###################################################
// Purpose : Tauri command bridge for HASM frontend
// Description : Wraps invoke calls for open, read-detail, and save operations.
// ###################################################

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export function validateHasmMarkdownApp() {
  return invoke("validate_hasm_markdown_app");
}

export function validateAppVersion() {
  return invoke("validate_app_version");
}

export function validateHasmFolderPath(path) {
  return invoke("validate_hasm_folder_path", { path });
}

export async function pickWorkspaceDirectory(defaultPath = "NewLife.hasm") {
  const { save } = await import("@tauri-apps/plugin-dialog");
  return save({ defaultPath });
}

export function createHasmWorkspace(targetDirectoryPath) {
  return invoke("create_hasm_workspace", { targetDirectoryPath });
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

export function subscribeToTauriEvent(eventName, handler) {
  return listen(eventName, handler);
}

export function checkWorkspaceLock(path) {
  return invoke("check_workspace_lock", { path });
}

export function releaseWorkspaceLock(path) {
  return invoke("release_workspace_lock", { path });
}

export function switchWorkspaceCleanly(currentModelPath, isReadOnly = false) {
  return invoke("switch_workspace_cleanly", { currentModelPath, isReadOnly });
}

export function loadHasmModelDb(path) {
  return invoke("load_hasm_model_db", { path });
}

export function verifyHasmStorage(path, model) {
  return invoke("verify_hasm_storage", { path, model });
}

export function computeVisualizerLayout(model, filter) {
  return invoke("compute_visualizer_layout", { model, filter });
}

export function createVisualizerDemoWorkspace() {
  return invoke("create_visualizer_demo_workspace");
}

export function createPerson(path, payload) {
  return invoke("create_person", { path, payload });
}

export function createExperience(path, payload) {
  return invoke("create_experience", { path, payload });
}

export function createFact(path, payload) {
  return invoke("create_fact", { path, payload });
}

export function createLink(path, payload) {
  return invoke("create_link", { path, payload });
}

export function loadEntityDetail(modelRoot, entityType, entityId) { return invoke("load_entity_detail", { modelRoot, entityType, entityId }); }
export function checkEntityMtime(modelRoot, entityType, entityId, lastLoadedMtimeMs) { return invoke("check_entity_mtime", { modelRoot, entityType, entityId, lastLoadedMtimeMs }); }
export function reloadEntityMarkdown(modelRoot, entityType, entityId) { return invoke("reload_entity_markdown", { modelRoot, entityType, entityId }); }
export function launchExternalMarkdownApp(modelRoot, entityType, entityId) { return invoke("launch_external_markdown_app", { modelRoot, entityType, entityId }); }