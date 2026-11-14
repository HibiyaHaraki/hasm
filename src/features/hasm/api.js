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

// [SEQ-MD-01][REQ-01-FUNC-201] Check 1: validates the external HASM Markdown executable exists.
export function validateHasmMarkdownApp() {
  return invoke("validate_hasm_markdown_app");
}

// [SEQ-MD-01][REQ-01-FUNC-301] Check 2: reads the app version and CLI launch path arguments.
export function validateAppVersion() {
  return invoke("validate_app_version");
}

// [SEQ-MD-01][REQ-01-FUNC-401][REQ-01-FUNC-503] Verifies a workspace folder path exists on disk,
// for both the CLI argument check and real-time /select input validation.
export function validateHasmFolderPath(path) {
  return invoke("validate_hasm_folder_path", { path });
}

// [SEQ-MD-01][SPLASH][REQ-01-FUNC-002][REQ-01-DATA-003] Reports boot completion; Rust closes the splash after its minimum duration.
export function completeAppLaunch(outcome) {
  return invoke("complete_app_launch", { outcome });
}

// [SEQ-MD-08][REQ-08-001] Native save directory dialog for creating a new HASM workspace.
export async function pickWorkspaceDirectory(defaultPath = "NewLife.hasm") {
  const { save } = await import("@tauri-apps/plugin-dialog");
  return save({ defaultPath });
}

// [SEQ-MD-02][REQ-02-RULE-012] Native single-folder picker used by the /select Browse action.
export async function browseWorkspaceDirectory() {
  const { open } = await import("@tauri-apps/plugin-dialog");
  return open({ directory: true, multiple: false, title: "Open a HASM workspace folder (.hasm)" });
}

// [SEQ-MD-08][REQ-01-RULE-008] Scaffolds a new workspace atomically (folders, hasm.db schema with the
// link JSON-array columns, and .hasm/lock) per REQ-08-002.
export function createHasmWorkspace(targetDirectoryPath) {
  return invoke("create_hasm_workspace", { targetDirectoryPath });
}

// [REQ-01-RULE-005] Shared frontend hard-timeout wrapper preventing UI lockup on IPC calls.
export function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

// [REQ-04-RULE-010] Whole-model read used for external URL array round-trip verification.
export function openHasmModel(modelRoot) {
  return invoke("open_hasm_model", { modelRoot });
}

// [SEQ-MD-04][REQ-04-RULE-010] Typed single-entity metadata read (get_*_detail) round-tripping the
// shared external URL array.
export function getEntityDetail(entityType, modelRoot, entityId) {
  const commands = {
    PERSON: "get_person_detail",
    EXPERIENCE: "get_experience_detail",
    FACT: "get_fact_detail",
    LINK: "get_link_detail",
  };

  return invoke(commands[entityType], { modelRoot, entityId });
}

// [SEQ-MD-04][REQ-04-RULE-010][REQ-04-RULE-016] Typed save invoke (save_*_detail) used by explicit
// section editing; persistence is transactional on the Rust side [REQ-04-RULE-003].
export function saveEntityDetail(entityType, modelRoot, detail) {
  const commands = {
    PERSON: "save_person_detail",
    EXPERIENCE: "save_experience_detail",
    FACT: "save_fact_detail",
    LINK: "save_link_detail",
  };

  return invoke(commands[entityType], { modelRoot, detail });
}

// [REQ-02-FUNC-108][REQ-02-FUNC-201][REQ-03-FUNC-101] Shared Tauri event subscription wrapper for
// close-requested, model load/verify progress, and visualizer layout progress streams.
export function subscribeToTauriEvent(eventName, handler) {
  return listen(eventName, handler);
}

// [SEQ-MD-02][REQ-02-FUNC-101] Checks/acquires the .hasm/lock file, recovering stale locks [REQ-02-RULE-002].
export function checkWorkspaceLock(path) {
  return invoke("check_workspace_lock", { path });
}

// [SEQ-MD-02][REQ-02-RULE-003][REQ-02-FUNC-109] Deletes .hasm/lock on graceful window close.
export function releaseWorkspaceLock(path) {
  return invoke("release_workspace_lock", { path });
}

// [SEQ-MD-07][REQ-07-RULE-003][REQ-07-FUNC-203] Atomic workspace switch: releases the lock, flushes
// pools, and resets the in-memory model before the frontend navigates to /select.
export function switchWorkspaceCleanly(currentModelPath, isReadOnly = false) {
  return invoke("switch_workspace_cleanly", { currentModelPath, isReadOnly });
}

// [SEQ-MD-02][REQ-02-RULE-008][REQ-02-FUNC-407] Metadata-only model load from hasm.db, invoked at most
// once per workspace open.
export function loadHasmModelDb(path) {
  return invoke("load_hasm_model_db", { path });
}

// [SEQ-MD-02][REQ-02-FUNC-301] Verifies physical storage structure for the loaded model.
export function verifyHasmStorage(path, model) {
  return invoke("verify_hasm_storage", { path, model });
}

// [SEQ-MD-03][REQ-03-FUNC-201] Requests 3D layout computation for the current model and filter;
// executed on a background Rust worker [REQ-03-RULE-003].
export function computeVisualizerLayout(model, filter) {
  return invoke("compute_visualizer_layout", { model, filter });
}

// [SEQ-MD-08][REQ-04-RULE-010] Creates a PERSON (optionally with a Life EXPERIENCE bootstrap) carrying
// the shared external URL array; see REQ-08-010 / REQ-08-015.
export function createPerson(path, payload) {
  return invoke("create_person", { path, payload });
}

// [SEQ-MD-08][REQ-04-RULE-010] Creates an EXPERIENCE with parent tree bindings and the shared external
// URL array; optional existing FACT memberships [REQ-08-023]; see REQ-08-011.
export function createExperience(path, payload) {
  return invoke("create_experience", { path, payload });
}

// [SEQ-MD-08][REQ-04-RULE-010] Creates a FACT with experience timeline bindings and the shared external
// URL array; see REQ-08-012.
export function createFact(path, payload) {
  return invoke("create_fact", { path, payload });
}

// [SEQ-MD-08][REQ-04-RULE-010] Creates a LINK between validated endpoints carrying the shared external
// URL array; see REQ-08-013.
export function createLink(path, payload) {
  return invoke("create_link", { path, payload });
}

// [SEQ-MD-04][REQ-04-RULE-028][REQ-04-RULE-029] Confirmed entity deletion with related-LINK handling,
// EXPERIENCE reassignment, and archival under .hasm/deleted/.
export function deleteEntity(path, request) {
  return invoke("delete_entity", { path, request });
}

// [SEQ-MD-04][REQ-04-FUNC-103][REQ-04-FUNC-114] Loads a verified entity detail payload (metadata,
// Markdown body, mtime); also backs the shared entity information preview [REQ-04-RULE-027].
export function loadEntityDetail(modelRoot, entityType, entityId) { return invoke("load_entity_detail", { modelRoot, entityType, entityId }); }
// [SEQ-MD-04][REQ-04-RULE-007][REQ-04-FUNC-502] Fast main.md mtime check on window focus without parsing content.
export function checkEntityMtime(modelRoot, entityType, entityId, lastLoadedMtimeMs) { return invoke("check_entity_mtime", { modelRoot, entityType, entityId, lastLoadedMtimeMs }); }
// [SEQ-MD-04][REQ-04-FUNC-507][REQ-06-FUNC-304] Re-reads and re-verifies the entity Markdown for manual refresh and error recovery.
export function reloadEntityMarkdown(modelRoot, entityType, entityId) { return invoke("reload_entity_markdown", { modelRoot, entityType, entityId }); }
// [SEQ-MD-05][REQ-05-FUNC-101] Spawns hasm_markdown.exe detached against the entity UUID directory [REQ-05-RULE-002].
export function launchExternalMarkdownApp(modelRoot, entityType, entityId) { return invoke("launch_external_markdown_app", { modelRoot, entityType, entityId }); }