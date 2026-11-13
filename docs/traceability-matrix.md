# Traceability Matrix

<!-- GENERATED FILE: do not edit by hand. -->
<!-- Regenerate with: npm run build:traceability -->

This matrix links every requirement in [docs/req/](./req/) to the code that
implements it and the test cases in [docs/eval/](./eval/) that verify it.
Code locations come from `[REQ-...]` comment tags on exported functions,
classes, Rust `pub` items, and Tauri commands.

- Requirements: **346**
- Test cases: **483**
- Tagged code items: **167 / 167**

## docs/req/10-REQ-01_AppLaunch_AppValidation.md

| Requirement | Code references | Positive tests | Negative tests |
| --- | --- | --- | --- |
| `REQ-01-RULE-001` | `src/pages/AppBootGatePage.jsx:36` AppBootGatePage | `TC-01-E2E-001`<br/>`TC-01-E2E-002` | `TC-01-E2E-008` |
| `REQ-01-RULE-002` | `src/pages/AppBootGatePage.jsx:36` AppBootGatePage | `TC-01-REACT-017` | `TC-01-E2E-005`<br/>`TC-01-REACT-007` |
| `REQ-01-RULE-003` | `src/pages/AppBootGatePage.jsx:36` AppBootGatePage | `TC-01-REACT-022` | `TC-01-E2E-006`<br/>`TC-01-REACT-010` |
| `REQ-01-RULE-004` | — | `TC-01-REACT-002` | `TC-01-REACT-021` |
| `REQ-01-RULE-005` | `src/features/hasm/api.js:53` withTimeout | `TC-01-REACT-023`<br/>`TC-01-REACT-024` | `TC-01-E2E-007`<br/>`TC-01-REACT-006`<br/>`TC-01-REACT-009`<br/>`TC-01-REACT-012` |
| `REQ-01-RULE-006` | — | `TC-01-RUST-021` | `TC-01-E2E-004` |
| `REQ-01-RULE-007` | `src-tauri/src/hasm/app_commands.rs:43` validate_hasm_folder_path | `TC-01-E2E-009`<br/>`TC-01-REACT-014`<br/>`TC-01-RUST-010` | `TC-01-REACT-026`<br/>`TC-01-RUST-016` |
| `REQ-01-RULE-008` | `src/features/hasm/api.js:48` createHasmWorkspace<br/>`src-tauri/src/hasm/entity_creation_commands.rs:24` create_hasm_workspace | `TC-01-RUST-LINK-001`<br/>`TC-01-RUST-LINK-002` | `TC-01-RUST-017`<br/>`TC-01-E2E-LINK-001` |
| `REQ-01-RULE-009` | `src-tauri/src/hasm/splash_commands.rs:52` remaining_splash_delay<br/>`src-tauri/src/hasm/splash_commands.rs:59` start_splash_fallback<br/>`src-tauri/src/lib.rs:19` run | `TC-01-E2E-010`<br/>`TC-01-RUST-014`<br/>`TC-01-RUST-019` | `TC-01-RUST-018` |
| `REQ-01-DATA-001` | `src-tauri/src/hasm/types.rs:14` AppValidationError | `TC-01-RUST-001` | `TC-01-RUST-015` |
| `REQ-01-DATA-002` | `src-tauri/src/hasm/types.rs:22` AppVersionResponse | `TC-01-RUST-001` | `TC-01-RUST-015` |
| `REQ-01-DATA-003` | `src/features/hasm/api.js:30` completeAppLaunch<br/>`src-tauri/src/hasm/splash_commands.rs:86` complete_app_launch<br/>`src-tauri/src/hasm/splash_commands.rs:123` show_main_window | `TC-01-IPC-002`<br/>`TC-01-RUST-013` | `TC-01-RUST-020` |
| `REQ-01-FUNC-001` | `src-tauri/src/lib.rs:19` run | `TC-01-E2E-010`<br/>`TC-01-RUST-022` | `TC-01-RUST-023` |
| `REQ-01-FUNC-002` | `src/features/hasm/api.js:30` completeAppLaunch<br/>`src/pages/AppBootGatePage.jsx:36` AppBootGatePage | `TC-01-REACT-015`<br/>`TC-01-IPC-002` | `TC-01-REACT-016` |
| `REQ-01-FUNC-003` | `src-tauri/src/hasm/splash_commands.rs:24` SplashState<br/>`src-tauri/src/hasm/splash_commands.rs:31` new<br/>`src-tauri/src/hasm/splash_commands.rs:52` remaining_splash_delay<br/>`src-tauri/src/hasm/splash_commands.rs:86` complete_app_launch<br/>`src-tauri/src/hasm/splash_commands.rs:123` show_main_window | `TC-01-E2E-010`<br/>`TC-01-RUST-011`<br/>`TC-01-RUST-012`<br/>`TC-01-RUST-013`<br/>`TC-01-RUST-014` | `TC-01-RUST-018` |
| `REQ-01-FUNC-004` | `src-tauri/src/hasm/splash_commands.rs:24` SplashState<br/>`src-tauri/src/hasm/splash_commands.rs:86` complete_app_launch | `TC-01-RUST-012`<br/>`TC-01-RUST-013` | `TC-01-RUST-018` |
| `REQ-01-FUNC-005` | `src-tauri/src/hasm/splash_commands.rs:59` start_splash_fallback | `TC-01-RUST-019` | `TC-01-RUST-018` |
| `REQ-01-FUNC-006` | — | `TC-01-IPC-003` | `TC-01-IPC-004` |
| `REQ-01-FUNC-101` | — | `TC-01-E2E-001`<br/>`TC-01-REACT-001` | `TC-01-REACT-019` |
| `REQ-01-FUNC-102` | — | `TC-01-REACT-001` | `TC-01-REACT-019` |
| `REQ-01-FUNC-103` | — | `TC-01-REACT-001` | `TC-01-REACT-019` |
| `REQ-01-FUNC-201` | `src/features/hasm/api.js:14` validateHasmMarkdownApp<br/>`src/pages/AppBootGatePage.jsx:36` AppBootGatePage | `TC-01-E2E-001`<br/>`TC-01-REACT-002` | `TC-01-REACT-007` |
| `REQ-01-FUNC-202` | `src-tauri/src/hasm/app_commands.rs:14` validate_hasm_markdown_app | `TC-01-RUST-002` | `TC-01-RUST-006` |
| `REQ-01-FUNC-203` | `src/pages/AppBootGatePage.jsx:36` AppBootGatePage | `TC-01-REACT-023` | `TC-01-REACT-006` |
| `REQ-01-FUNC-204` | — | `TC-01-REACT-017` | `TC-01-E2E-005`<br/>`TC-01-REACT-006`<br/>`TC-01-REACT-007` |
| `REQ-01-FUNC-205` | `src/pages/AppBootGatePage.jsx:36` AppBootGatePage | `TC-01-REACT-017` | `TC-01-E2E-005`<br/>`TC-01-REACT-006`<br/>`TC-01-REACT-007` |
| `REQ-01-FUNC-206` | `src/pages/AppBootGatePage.jsx:36` AppBootGatePage | `TC-01-REACT-002` | `TC-01-REACT-019` |
| `REQ-01-FUNC-207` | `src-tauri/src/hasm/app_commands.rs:14` validate_hasm_markdown_app | `TC-01-RUST-009` | `TC-01-RUST-006` |
| `REQ-01-FUNC-301` | `src/features/hasm/api.js:19` validateAppVersion<br/>`src/pages/AppBootGatePage.jsx:36` AppBootGatePage | `TC-01-E2E-001`<br/>`TC-01-REACT-002` | `TC-01-REACT-020` |
| `REQ-01-FUNC-302` | `src-tauri/src/hasm/app_commands.rs:24` validate_app_version | `TC-01-RUST-003` | `TC-01-RUST-015` |
| `REQ-01-FUNC-303` | `src-tauri/src/hasm/app_commands.rs:24` validate_app_version | `TC-01-RUST-003` | `TC-01-E2E-008` |
| `REQ-01-FUNC-304` | `src-tauri/src/hasm/app_commands.rs:24` validate_app_version | `TC-01-E2E-002`<br/>`TC-01-RUST-004` | `TC-01-RUST-016` |
| `REQ-01-FUNC-305` | `src-tauri/src/hasm/app_commands.rs:24` validate_app_version | `TC-01-E2E-002`<br/>`TC-01-RUST-004` | `TC-01-RUST-016` |
| `REQ-01-FUNC-311` | `src-tauri/src/hasm/app_commands.rs:24` validate_app_version | `TC-01-E2E-009`<br/>`TC-01-RUST-010` | `TC-01-RUST-016` |
| `REQ-01-FUNC-306` | `src-tauri/src/hasm/app_commands.rs:24` validate_app_version | `TC-01-E2E-001`<br/>`TC-01-RUST-003` | `TC-01-RUST-016` |
| `REQ-01-FUNC-307` | — | `TC-01-REACT-018` | `TC-01-REACT-008` |
| `REQ-01-FUNC-308` | `src/pages/AppBootGatePage.jsx:36` AppBootGatePage | `TC-01-REACT-018` | `TC-01-REACT-008` |
| `REQ-01-FUNC-309` | `src/pages/AppBootGatePage.jsx:36` AppBootGatePage | `TC-01-REACT-002` | `TC-01-REACT-020` |
| `REQ-01-FUNC-310` | `src/pages/AppBootGatePage.jsx:36` AppBootGatePage | `TC-01-REACT-002` | `TC-01-REACT-021` |
| `REQ-01-FUNC-401` | `src/features/hasm/api.js:25` validateHasmFolderPath<br/>`src/pages/AppBootGatePage.jsx:36` AppBootGatePage | `TC-01-E2E-002` | `TC-01-REACT-028` |
| `REQ-01-FUNC-402` | `src-tauri/src/hasm/app_commands.rs:43` validate_hasm_folder_path | `TC-01-E2E-002`<br/>`TC-01-RUST-005` | `TC-01-RUST-007`<br/>`TC-01-RUST-008` |
| `REQ-01-FUNC-403` | `src/pages/AppBootGatePage.jsx:36` AppBootGatePage | `TC-01-REACT-023` | `TC-01-REACT-009` |
| `REQ-01-FUNC-404` | `src/pages/AppBootGatePage.jsx:36` AppBootGatePage | `TC-01-REACT-022` | `TC-01-E2E-006`<br/>`TC-01-REACT-009`<br/>`TC-01-REACT-010` |
| `REQ-01-FUNC-405` | `src/pages/AppBootGatePage.jsx:36` AppBootGatePage | `TC-01-REACT-022` | `TC-01-E2E-006`<br/>`TC-01-E2E-008`<br/>`TC-01-REACT-009`<br/>`TC-01-REACT-010` |
| `REQ-01-FUNC-406` | `src/pages/AppBootGatePage.jsx:36` AppBootGatePage | `TC-01-E2E-002`<br/>`TC-01-REACT-002` | `TC-01-REACT-021` |
| `REQ-01-FUNC-501` | — | `TC-01-E2E-001` | `TC-01-E2E-006`<br/>`TC-01-REACT-009`<br/>`TC-01-REACT-010`<br/>`TC-01-REACT-013` |
| `REQ-01-FUNC-502` | `src/pages/AppBootGatePage.jsx:36` AppBootGatePage | `TC-01-E2E-001` | `TC-01-E2E-006`<br/>`TC-01-REACT-009`<br/>`TC-01-REACT-010` |
| `REQ-01-FUNC-503` | `src/features/hasm/api.js:25` validateHasmFolderPath<br/>`src/pages/SelectModelPage.jsx:31` SelectModelPage | `TC-01-E2E-003`<br/>`TC-01-RUST-005` | `TC-01-RUST-007` |
| `REQ-01-FUNC-504` | `src/pages/SelectModelPage.jsx:31` SelectModelPage | `TC-01-REACT-003` | `TC-01-REACT-025` |
| `REQ-01-FUNC-505` | `src/pages/SelectModelPage.jsx:31` SelectModelPage | `TC-01-REACT-024` | `TC-01-E2E-007`<br/>`TC-01-REACT-012` |
| `REQ-01-FUNC-506` | `src/pages/SelectModelPage.jsx:31` SelectModelPage | `TC-01-E2E-003`<br/>`TC-01-REACT-004`<br/>`TC-01-REACT-027` | `TC-01-REACT-011` |
| `REQ-01-FUNC-507` | — | `TC-01-REACT-004`<br/>`TC-01-REACT-027` | `TC-01-REACT-011` |
| `REQ-01-FUNC-508` | `src/pages/SelectModelPage.jsx:31` SelectModelPage | `TC-01-REACT-027` | `TC-01-E2E-007`<br/>`TC-01-REACT-011`<br/>`TC-01-REACT-012` |
| `REQ-01-FUNC-509` | `src/pages/SelectModelPage.jsx:31` SelectModelPage | `TC-01-REACT-027` | `TC-01-E2E-007`<br/>`TC-01-REACT-011`<br/>`TC-01-REACT-012` |
| `REQ-01-FUNC-510` | `src/pages/SelectModelPage.jsx:31` SelectModelPage | `TC-01-E2E-003`<br/>`TC-01-REACT-005` | `TC-01-REACT-013` |
| `REQ-01-FUNC-512` | `src/pages/SelectModelPage.jsx:31` SelectModelPage | `TC-01-E2E-009`<br/>`TC-01-REACT-014` | `TC-01-REACT-026` |
| `REQ-01-FUNC-511` | — | `TC-01-E2E-003`<br/>`TC-01-REACT-005` | `TC-01-REACT-013` |
| `REQ-01-FUNC-601` | `src/pages/AppBootGatePage.jsx:36` AppBootGatePage<br/>`src/pages/SelectModelPage.jsx:31` SelectModelPage | `TC-01-E2E-002`<br/>`TC-01-E2E-003`<br/>`TC-01-REACT-005` | `TC-01-REACT-021` |
| `REQ-01-FUNC-602` | `src/pages/AppBootGatePage.jsx:36` AppBootGatePage<br/>`src/pages/SelectModelPage.jsx:31` SelectModelPage | `TC-01-E2E-002`<br/>`TC-01-E2E-003`<br/>`TC-01-REACT-005` | `TC-01-REACT-021` |

## docs/req/11-REQ-02_HASM_Model_Load.md

| Requirement | Code references | Positive tests | Negative tests |
| --- | --- | --- | --- |
| `REQ-02-RULE-001` | — | `TC-02-E2E-001` | `TC-02-E2E-004` |
| `REQ-02-RULE-002` | `src/features/hasm/api.js:100` checkWorkspaceLock<br/>`src-tauri/src/hasm/model_commands.rs:25` check_workspace_lock | `TC-02-E2E-002`<br/>`TC-02-RUST-002` | `TC-02-RUST-010` |
| `REQ-02-RULE-003` | `src/App.jsx:54` App<br/>`src/features/hasm/api.js:105` releaseWorkspaceLock<br/>`src-tauri/src/hasm/model_commands.rs:80` release_workspace_lock | `TC-02-E2E-003`<br/>`TC-02-RUST-003` | `TC-02-REACT-007` |
| `REQ-02-RULE-004` | — | `TC-02-IPC-LOAD-001` | `TC-02-IPC-LOAD-002` |
| `REQ-02-RULE-005` | — | `TC-02-REACT-009`<br/>`TC-02-RUST-018` | `TC-02-REACT-004` |
| `REQ-02-RULE-006` | `src-tauri/src/hasm/model_commands.rs:154` verify_hasm_storage<br/>`src-tauri/src/hasm/types.rs:55` VerificationResult | `TC-02-RUST-005` | `TC-02-E2E-005`<br/>`TC-02-RUST-006`<br/>`TC-02-IPC-LOAD-002`<br/>`TC-NAV-013` |
| `REQ-02-RULE-007` | — | `TC-02-E2E-PERF-001`<br/>`TC-02-RUST-PERF-001` | `TC-02-RUST-019` |
| `REQ-02-RULE-008` | `src/features/hasm/api.js:117` loadHasmModelDb<br/>`src-tauri/src/hasm/model_commands.rs:104` load_hasm_model_db<br/>`src-tauri/src/hasm/service.rs:86` read_model_database_with_progress<br/>`src-tauri/src/hasm/types.rs:182` ModelDatabase | `TC-02-REACT-PERF-001`<br/>`TC-02-RUST-PERF-001` | `TC-02-RUST-014` |
| `REQ-02-RULE-009` | `src-tauri/src/hasm/commands.rs:13` open_hasm_model<br/>`src-tauri/src/hasm/service.rs:23` open_hasm_model | `TC-02-E2E-PERF-002`<br/>`TC-02-RUST-PERF-002` | `TC-02-RUST-015` |
| `REQ-02-RULE-010` | `src-tauri/src/hasm/model_commands.rs:25` check_workspace_lock | `TC-02-RUST-009` | `TC-NAV-IPC-001` |
| `REQ-02-RULE-011` | `src/pages/LoadingModelPage.jsx:45` LoadingModelPage | `TC-02-REACT-011` | `TC-02-REACT-PROGRESS-002`<br/>`TC-02-REACT-010`<br/>`TC-NAV-006`<br/>`TC-NAV-009` |
| `REQ-02-RULE-012` | `src/features/hasm/api.js:41` browseWorkspaceDirectory<br/>`src/pages/SelectModelPage.jsx:31` SelectModelPage | `TC-02-DIALOG-001` | `TC-02-DIALOG-002` |
| `REQ-02-RULE-013` | `src/pages/LoadingModelPage.jsx:45` LoadingModelPage<br/>`src-tauri/src/hasm/service.rs:99` read_model_database_with_stage_progress | `TC-02-REACT-PROGRESS-001` | `TC-02-REACT-PROGRESS-002` |
| `REQ-02-RULE-014` | `src/pages/LoadingModelPage.jsx:45` LoadingModelPage | `TC-02-REACT-CONTINUE-001` | `TC-02-REACT-010` |
| `REQ-02-RULE-015` | `src-tauri/src/hasm/model_commands.rs:25` check_workspace_lock<br/>`src-tauri/src/hasm/model_commands.rs:104` load_hasm_model_db<br/>`src-tauri/src/hasm/model_commands.rs:154` verify_hasm_storage | `TC-02-IPC-RESPONSIVE-001` | `TC-NAV-PROGRESS-001`<br/>`TC-02-REACT-PROGRESS-003` |
| `REQ-02-DATA-001` | — | `TC-02-RUST-001` | `TC-02-RUST-013` |
| `REQ-02-DATA-002` | `src-tauri/src/hasm/types.rs:32` LockStatus | `TC-02-RUST-001` | `TC-02-RUST-013` |
| `REQ-02-DATA-003` | — | `TC-02-RUST-001` | `TC-02-RUST-013` |
| `REQ-02-DATA-004` | `src-tauri/src/hasm/types.rs:43` ProgressPayload | `TC-02-IPC-LOAD-001` | `TC-02-RUST-013` |
| `REQ-02-DATA-005` | — | `TC-02-IPC-LOAD-003` | `TC-02-REACT-003`<br/>`TC-02-REACT-008`<br/>`TC-02-IPC-LOAD-002` |
| `REQ-02-DATA-006` | `src-tauri/src/hasm/types.rs:171` ModelWorkspace | `TC-02-RUST-007` | `TC-02-RUST-008` |
| `REQ-02-DATA-007` | `src-tauri/src/hasm/types.rs:161` EntitySummary | `TC-02-RUST-007` | `TC-02-RUST-008` |
| `REQ-02-FUNC-101` | `src/features/hasm/api.js:100` checkWorkspaceLock<br/>`src/pages/LoadingModelPage.jsx:45` LoadingModelPage | `TC-02-E2E-001` | `TC-02-REACT-003` |
| `REQ-02-FUNC-102` | `src/pages/LoadingModelPage.jsx:45` LoadingModelPage | `TC-02-REACT-009`<br/>`TC-02-IPC-002` | `TC-02-REACT-003` |
| `REQ-02-FUNC-103` | `src-tauri/src/hasm/model_commands.rs:25` check_workspace_lock | `TC-02-RUST-004` | `TC-02-E2E-004` |
| `REQ-02-FUNC-104` | `src/pages/LoadingModelPage.jsx:45` LoadingModelPage | `TC-02-REACT-CONTINUE-001` | `TC-02-E2E-004` |
| `REQ-02-FUNC-105` | `src-tauri/src/hasm/model_commands.rs:25` check_workspace_lock | `TC-02-E2E-002`<br/>`TC-02-RUST-002` | `TC-02-RUST-010` |
| `REQ-02-FUNC-106` | `src/pages/LoadingModelPage.jsx:45` LoadingModelPage | `TC-02-E2E-002`<br/>`TC-02-REACT-001` | `TC-02-REACT-006` |
| `REQ-02-FUNC-107` | `src-tauri/src/hasm/entity_creation_commands.rs:24` create_hasm_workspace<br/>`src-tauri/src/hasm/model_commands.rs:25` check_workspace_lock | `TC-02-E2E-001` | `TC-02-RUST-010` |
| `REQ-02-FUNC-108` | `src/App.jsx:54` App<br/>`src/features/hasm/api.js:95` subscribeToTauriEvent | `TC-02-E2E-003`<br/>`TC-02-REACT-002` | `TC-02-REACT-007` |
| `REQ-02-FUNC-109` | `src/App.jsx:54` App<br/>`src/features/hasm/api.js:105` releaseWorkspaceLock<br/>`src-tauri/src/hasm/model_commands.rs:80` release_workspace_lock | `TC-02-E2E-003`<br/>`TC-02-REACT-002`<br/>`TC-02-RUST-003` | `TC-02-REACT-007` |
| `REQ-02-FUNC-110` | `src-tauri/src/hasm/model_commands.rs:25` check_workspace_lock | `TC-02-RUST-011` | `TC-02-E2E-006` |
| `REQ-02-FUNC-201` | `src/features/hasm/api.js:95` subscribeToTauriEvent<br/>`src/pages/LoadingModelPage.jsx:45` LoadingModelPage | `TC-02-REACT-011` | `TC-02-REACT-012` |
| `REQ-02-FUNC-202` | `src-tauri/src/hasm/model_commands.rs:104` load_hasm_model_db | `TC-02-IPC-LOAD-001` | `TC-02-REACT-008`<br/>`TC-02-IPC-LOAD-002` |
| `REQ-02-FUNC-203` | `src/pages/LoadingModelPage.jsx:45` LoadingModelPage | `TC-02-REACT-009` | `TC-02-REACT-004` |
| `REQ-02-FUNC-204` | `src/pages/LoadingModelPage.jsx:45` LoadingModelPage | `TC-02-REACT-005` | `TC-02-REACT-PROGRESS-002`<br/>`TC-02-REACT-PROGRESS-003` |
| `REQ-02-FUNC-205` | `src/pages/LoadingModelPage.jsx:45` LoadingModelPage | `TC-02-REACT-009` | `TC-02-REACT-004` |
| `REQ-02-FUNC-206` | `src-tauri/src/hasm/definitions/experience.rs:14` Experience<br/>`src-tauri/src/hasm/definitions/fact.rs:14` Fact<br/>`src-tauri/src/hasm/definitions/link.rs:14` Link<br/>`src-tauri/src/hasm/definitions/person.rs:14` Person<br/>`src-tauri/src/hasm/model_commands.rs:104` load_hasm_model_db<br/>`src-tauri/src/hasm/service.rs:78` read_model_database<br/>`src-tauri/src/hasm/service.rs:86` read_model_database_with_progress<br/>`src-tauri/src/hasm/service.rs:99` read_model_database_with_stage_progress | `TC-02-RUST-018`<br/>`TC-02-IPC-LOAD-001` | `TC-02-RUST-016`<br/>`TC-02-IPC-LOAD-002` |
| `REQ-02-FUNC-207` | `src-tauri/src/hasm/service.rs:78` read_model_database<br/>`src-tauri/src/hasm/types.rs:182` ModelDatabase | `TC-02-IPC-LOAD-001` | `TC-02-IPC-LOAD-002` |
| `REQ-02-FUNC-301` | `src/features/hasm/api.js:122` verifyHasmStorage<br/>`src-tauri/src/hasm/definitions/experience.rs:29` default_markdown_path<br/>`src-tauri/src/hasm/definitions/fact.rs:30` default_markdown_path<br/>`src-tauri/src/hasm/definitions/link.rs:28` default_markdown_path<br/>`src-tauri/src/hasm/definitions/person.rs:29` default_markdown_path<br/>`src-tauri/src/hasm/model_commands.rs:154` verify_hasm_storage<br/>`src-tauri/src/hasm/types.rs:55` VerificationResult | `TC-02-RUST-005`<br/>`TC-02-IPC-LOAD-001` | `TC-02-RUST-006`<br/>`TC-02-IPC-LOAD-002` |
| `REQ-02-FUNC-302` | `src/pages/LoadingModelPage.jsx:45` LoadingModelPage | `TC-02-REACT-009` | `TC-02-REACT-PROGRESS-002` |
| `REQ-02-FUNC-303` | `src-tauri/src/hasm/model_commands.rs:154` verify_hasm_storage | `TC-02-REACT-005`<br/>`TC-02-IPC-LOAD-001` | `TC-02-IPC-LOAD-002` |
| `REQ-02-FUNC-304` | `src-tauri/src/hasm/model_commands.rs:154` verify_hasm_storage | `TC-02-IPC-LOAD-003` | `TC-02-E2E-005`<br/>`TC-02-RUST-006` |
| `REQ-02-FUNC-305` | — | `TC-02-REACT-CONTINUE-001`<br/>`TC-02-RUST-005` | `TC-02-REACT-010` |
| `REQ-02-FUNC-306` | `src/pages/LoadingModelPage.jsx:45` LoadingModelPage<br/>`src/pages/ModelInitializationPage.jsx:17` ModelInitializationPage | `TC-02-E2E-001`<br/>`TC-02-REACT-PROGRESS-001` | `TC-02-REACT-PROGRESS-003`<br/>`TC-02-REACT-010` |
| `REQ-02-FUNC-401` | — | `TC-02-E2E-PERF-001` | `TC-02-RUST-019` |
| `REQ-02-FUNC-402` | — | `TC-02-RUST-PERF-002` | `TC-02-RUST-016` |
| `REQ-02-FUNC-403` | `src-tauri/src/hasm/commands.rs:13` open_hasm_model<br/>`src-tauri/src/hasm/service.rs:23` open_hasm_model | `TC-02-E2E-PERF-002`<br/>`TC-02-RUST-PERF-002` | `TC-02-RUST-015` |
| `REQ-02-FUNC-404` | — | `TC-02-RUST-PERF-003` | `TC-02-RUST-017` |
| `REQ-02-FUNC-405` | `src-tauri/src/hasm/service.rs:23` open_hasm_model | `TC-02-RUST-PERF-003` | `TC-02-RUST-017` |
| `REQ-02-FUNC-406` | `src-tauri/src/hasm/definitions/experience.rs:14` Experience<br/>`src-tauri/src/hasm/definitions/fact.rs:14` Fact<br/>`src-tauri/src/hasm/definitions/link.rs:14` Link<br/>`src-tauri/src/hasm/definitions/person.rs:14` Person<br/>`src-tauri/src/hasm/model_commands.rs:104` load_hasm_model_db<br/>`src-tauri/src/hasm/service.rs:86` read_model_database_with_progress | `TC-02-REACT-PERF-001`<br/>`TC-02-RUST-PERF-001` | `TC-02-RUST-014` |
| `REQ-02-FUNC-407` | `src/features/hasm/api.js:117` loadHasmModelDb<br/>`src/pages/LoadingModelPage.jsx:45` LoadingModelPage | `TC-02-REACT-PERF-001`<br/>`TC-02-REACT-CONTINUE-001` | `TC-02-REACT-PROGRESS-003`<br/>`TC-02-REACT-010` |
| `REQ-02-FUNC-408` | `src-tauri/src/hasm/model_commands.rs:154` verify_hasm_storage | `TC-02-RUST-PERF-001` | `TC-02-RUST-019` |
| `REQ-02-FUNC-409` | `src-tauri/src/hasm/model_commands.rs:25` check_workspace_lock | `TC-02-RUST-011` | `TC-02-RUST-012` |
| `REQ-02-FUNC-410` | `src-tauri/src/hasm/model_commands.rs:104` load_hasm_model_db<br/>`src-tauri/src/hasm/service.rs:99` read_model_database_with_stage_progress | `TC-02-RUST-018` | `TC-02-IPC-LOAD-002` |
| `REQ-02-FUNC-411` | — | `TC-02-RUST-PERF-002` | `TC-02-RUST-017` |

## docs/req/12-REQ-03_Visualizer.md

| Requirement | Code references | Positive tests | Negative tests |
| --- | --- | --- | --- |
| `REQ-03-RULE-020` | — | `TC-03-VIEW-007` | `TC-03-VIEW-001` |
| `REQ-03-RULE-001` | `src-tauri/src/hasm/visualizer_commands.rs:19` compute_visualizer_layout | `TC-03-E2E-001`<br/>`TC-03-REACT-006`<br/>`TC-03-VIEW-005` | `TC-03-E2E-002`<br/>`TC-03-E2E-003`<br/>`TC-03-RUST-003`<br/>`TC-03-RUST-004`<br/>`TC-03-RUST-IPC-001` |
| `REQ-03-RULE-002` | `src-tauri/src/hasm/visualizer_commands.rs:19` compute_visualizer_layout | `TC-03-E2E-001`<br/>`TC-03-RUST-005` | `TC-03-RUST-008` |
| `REQ-03-RULE-003` | `src/features/hasm/api.js:128` computeVisualizerLayout | `TC-03-E2E-001`<br/>`TC-03-RUST-002` | `TC-03-RUST-009` |
| `REQ-03-RULE-004` | — | `TC-03-REACT-001`<br/>`TC-03-REACT-009` | `TC-03-REACT-002` |
| `REQ-03-RULE-005` | — | `TC-03-REACT-005` | `TC-03-REACT-2D-003`<br/>`TC-03-REACT-003`<br/>`TC-03-REACT-010` |
| `REQ-03-RULE-006` | `src-tauri/src/hasm/visualizer_commands.rs:19` compute_visualizer_layout | `TC-03-RUST-006` | `TC-03-RUST-008` |
| `REQ-03-RULE-007` | `src-tauri/src/hasm/visualizer_commands.rs:19` compute_visualizer_layout | `TC-03-RUST-006`<br/>`TC-03-RUST-014` | `TC-03-RUST-009` |
| `REQ-03-RULE-008` | — | `TC-03-IPC-005` | `TC-03-IPC-006` |
| `REQ-03-RULE-009` | — | `TC-03-COLOR-001`<br/>`TC-03-VIEW-003` | `TC-03-COLOR-002` |
| `REQ-03-RULE-010` | — | `TC-03-RUST-014` | `TC-03-RUST-011` |
| `REQ-03-RULE-011` | — | `TC-03-RUST-006` | `TC-03-VIEW-001` |
| `REQ-03-RULE-012` | `src-tauri/src/hasm/visualizer_commands.rs:19` compute_visualizer_layout | `TC-03-IPC-003`<br/>`TC-03-RUST-006` | `TC-03-RUST-010` |
| `REQ-03-RULE-013` | — | `TC-03-HOVER-001`<br/>`TC-03-IPC-003` | `TC-03-HOVER-002` |
| `REQ-03-RULE-014` | `src/pages/VisualizerPage.jsx:30` VisualizerPage | `TC-03-REACT-SCOPE-001`<br/>`TC-03-VIEW-004` | `TC-03-VIEW-001` |
| `REQ-03-RULE-015` | — | `TC-03-REACT-SCOPE-003` | `TC-03-REACT-008` |
| `REQ-03-RULE-016` | — | `TC-03-BUDGET-001` | `TC-03-BUDGET-002` |
| `REQ-03-RULE-017` | — | `TC-03-IPC-002` | `TC-03-RUST-012` |
| `REQ-03-RULE-018` | `src/pages/VisualizerPage.jsx:30` VisualizerPage | `TC-NAV-002` | `TC-NAV-001`<br/>`TC-NAV-003`<br/>`TC-NAV-005`<br/>`TC-NAV-009`<br/>`TC-NAV-011`<br/>`TC-03-REACT-007` |
| `REQ-03-RULE-019` | `src-tauri/src/hasm/visualizer_commands.rs:662` create_test_workspace_fixture | `TC-NAV-002` | `TC-NAV-IPC-001` |
| `REQ-03-DATA-001` | `src-tauri/src/hasm/types.rs:63` LayoutFilterRequest | `TC-03-RUST-001`<br/>`TC-03-RUST-013` | `TC-03-RUST-012` |
| `REQ-03-DATA-002` | — | `TC-03-RUST-001`<br/>`TC-03-RUST-IPC-002` | `TC-03-RUST-IPC-001` |
| `REQ-03-DATA-003` | `src-tauri/src/hasm/types.rs:71` Node3dGeometry<br/>`src-tauri/src/hasm/types.rs:92` Line3dGeometry<br/>`src-tauri/src/hasm/types.rs:108` RenderPayload | `TC-03-RUST-001`<br/>`TC-03-RUST-013`<br/>`TC-03-RUST-IPC-002` | `TC-03-RUST-012` |
| `REQ-03-DATA-004` | — | `TC-03-REACT-006` | `TC-03-RUST-IPC-001` |
| `REQ-03-FUNC-101` | `src/features/hasm/api.js:95` subscribeToTauriEvent<br/>`src/pages/VisualizerPage.jsx:30` VisualizerPage | `TC-03-E2E-001` | `TC-03-REACT-007` |
| `REQ-03-FUNC-102` | `src/pages/VisualizerPage.jsx:30` VisualizerPage | `TC-03-REACT-006` | `TC-03-E2E-002`<br/>`TC-03-RUST-003` |
| `REQ-03-FUNC-103` | `src/pages/VisualizerPage.jsx:30` VisualizerPage | `TC-03-REACT-006`<br/>`TC-03-VIEW-005` | `TC-03-E2E-003`<br/>`TC-03-RUST-004` |
| `REQ-03-FUNC-104` | `src/pages/VisualizerPage.jsx:30` VisualizerPage | `TC-03-REACT-001` | `TC-03-REACT-002` |
| `REQ-03-FUNC-105` | `src-tauri/src/hasm/visualizer_commands.rs:19` compute_visualizer_layout | `TC-03-RUST-002`<br/>`TC-03-RUST-IPC-002` | `TC-03-RUST-IPC-001` |
| `REQ-03-FUNC-106` | `src/pages/VisualizerPage.jsx:30` VisualizerPage | `TC-03-REACT-001`<br/>`TC-03-REACT-009` | `TC-03-REACT-002`<br/>`TC-03-REACT-007` |
| `REQ-03-FUNC-107` | `src/pages/VisualizerPage.jsx:30` VisualizerPage | `TC-03-REACT-009` | `TC-03-REACT-002` |
| `REQ-03-FUNC-108` | — | `TC-03-E2E-001`<br/>`TC-03-REACT-001` | `TC-03-REACT-003`<br/>`TC-03-REACT-010` |
| `REQ-03-FUNC-109` | — | `TC-03-REACT-004` | `TC-03-REACT-011` |
| `REQ-03-FUNC-201` | `src/features/hasm/api.js:128` computeVisualizerLayout<br/>`src/pages/VisualizerPage.jsx:30` VisualizerPage | `TC-03-E2E-004`<br/>`TC-03-REACT-005`<br/>`TC-03-VIEW-002` | `TC-03-REACT-003` |
| `REQ-03-FUNC-202` | `src/pages/VisualizerPage.jsx:30` VisualizerPage | `TC-03-E2E-004`<br/>`TC-03-REACT-005` | `TC-03-IPC-006` |
| `REQ-03-FUNC-203` | `src/pages/VisualizerPage.jsx:30` VisualizerPage | `TC-03-REACT-005` | `TC-03-REACT-003` |
| `REQ-03-FUNC-204` | — | `TC-03-IPC-005` | `TC-03-IPC-006`<br/>`TC-03-RUST-008` |
| `REQ-03-FUNC-301` | — | `TC-03-E2E-005`<br/>`TC-03-IPC-005` | `TC-03-HOVER-002` |
| `REQ-03-FUNC-302` | `src/pages/VisualizerPage.jsx:30` VisualizerPage | `TC-03-E2E-005`<br/>`TC-03-VIEW-006` | `TC-03-VIEW-001` |
| `REQ-03-FUNC-303` | `src-tauri/src/hasm/visualizer_commands.rs:19` compute_visualizer_layout | `TC-03-RUST-006` | `TC-03-RUST-009` |
| `REQ-03-FUNC-304` | — | `TC-03-E2E-007`<br/>`TC-03-VIEW-004` | `TC-03-REACT-010` |
| `REQ-03-FUNC-305` | — | `TC-03-IPC-005` | `TC-03-IPC-006` |
| `REQ-03-FUNC-306` | `src-tauri/src/hasm/visualizer_commands.rs:19` compute_visualizer_layout | `TC-03-RUST-006` | `TC-03-RUST-010` |
| `REQ-03-FUNC-501` | — | `TC-03-REACT-SCOPE-005`<br/>`TC-03-REACT-SCOPE-001`<br/>`TC-03-REACT-SCOPE-002`<br/>`TC-03-REACT-TOOLBAR-001` | `TC-03-REACT-SCOPE-004`<br/>`TC-03-REACT-TOOLBAR-002` |
| `REQ-03-FUNC-502` | — | `TC-03-SCOPE-004` | `TC-03-REACT-SCOPE-006`<br/>`TC-03-SCOPE-008` |
| `REQ-03-FUNC-503` | — | `TC-03-REACT-SCOPE-005`<br/>`TC-03-IPC-002`<br/>`TC-03-REACT-SCOPE-001`<br/>`TC-03-REACT-SCOPE-002`<br/>`TC-03-SCOPE-002`<br/>`TC-03-SCOPE-003` | `TC-03-SCOPE-006`<br/>`TC-03-SCOPE-007` |
| `REQ-03-FUNC-504` | — | `TC-03-SCOPE-001` | `TC-03-SCOPE-008` |
| `REQ-03-FUNC-505` | — | `TC-03-REACT-SCOPE-001` | `TC-03-REACT-008` |
| `REQ-03-FUNC-506` | — | `TC-03-REACT-SCOPE-003` | `TC-03-REACT-008` |
| `REQ-03-FUNC-507` | — | `TC-03-BUDGET-001` | `TC-03-BUDGET-002` |
| `REQ-03-FUNC-508` | — | `TC-03-SCOPE-005` | `TC-03-SCOPE-008` |
| `REQ-03-FUNC-509` | — | `TC-03-REACT-2D-001` | `TC-03-REACT-2D-003` |
| `REQ-03-FUNC-510` | — | `TC-03-ZSCALE-001`<br/>`TC-03-IPC-002` | `TC-03-REACT-2D-002` |
| `REQ-03-FUNC-511` | — | `TC-03-REACT-TOOLBAR-001` | `TC-03-REACT-TOOLBAR-002` |
| `REQ-03-FUNC-512` | — | `TC-03-IPC-005` | `TC-03-IPC-006` |

## docs/req/13-REQ-04_Entity_Editing.md

| Requirement | Code references | Positive tests | Negative tests |
| --- | --- | --- | --- |
| `REQ-04-RULE-028` | `src/features/entityTicket/EntityDeleteDialog.jsx:8` EntityDeleteDialog<br/>`src/features/entityTicket/EntityReferences.js:76` relatedLinkIds<br/>`src/features/hasm/api.js:158` deleteEntity<br/>`src-tauri/src/hasm/entity_deletion_commands.rs:17` DeleteRequest<br/>`src-tauri/src/hasm/entity_deletion_commands.rs:66` delete_entity | `TC-NAV-DELETE-001`<br/>`TC-NAV-DELETE-003`<br/>`TC-04-IPC-DELETE-001`<br/>`TC-04-IPC-DELETE-002` | `TC-NAV-DELETE-002`<br/>`TC-NAV-DELETE-004`<br/>`TC-NAV-DELETE-005`<br/>`TC-04-IPC-DELETE-003` |
| `REQ-04-RULE-029` | `src/features/entityTicket/EntityDeleteDialog.jsx:8` EntityDeleteDialog<br/>`src/features/hasm/api.js:158` deleteEntity<br/>`src-tauri/src/hasm/entity_deletion_commands.rs:17` DeleteRequest<br/>`src-tauri/src/hasm/entity_deletion_commands.rs:44` DeleteResult<br/>`src-tauri/src/hasm/entity_deletion_commands.rs:66` delete_entity | `TC-NAV-DELETE-001`<br/>`TC-NAV-DELETE-003`<br/>`TC-04-IPC-DELETE-001`<br/>`TC-04-IPC-DELETE-002`<br/>`TC-04-IPC-DELETE-006` | `TC-NAV-DELETE-005`<br/>`TC-04-IPC-DELETE-003`<br/>`TC-04-IPC-DELETE-004`<br/>`TC-04-IPC-DELETE-005` |
| `REQ-04-RULE-025` | `src/features/entityTicket/EntityCommitGraph.jsx:23` EntityCommitGraph | `TC-04-GRAPH-SEQUENTIAL-001`<br/>`TC-04-GRAPH-SEQUENTIAL-003`<br/>`TC-04-GRAPH-SEQUENTIAL-004` | `TC-04-GRAPH-SEQUENTIAL-001`<br/>`TC-04-GRAPH-SEQUENTIAL-002` |
| `REQ-04-RULE-024` | `src/features/entityTicket/EntityCommitGraph.jsx:23` EntityCommitGraph | `TC-04-GRAPH-EMPHASIS-001` | `TC-04-GRAPH-EMPHASIS-002` |
| `REQ-04-RULE-023` | `src/features/entityTicket/EntityCommitGraph.jsx:23` EntityCommitGraph<br/>`src/features/entityTicket/entityGraphModel.js:7` extractEntityGraphModel | `TC-04-GRAPH-SEQUENTIAL-004`<br/>`TC-04-GRAPH-001`<br/>`TC-04-GRAPH-002`<br/>`TC-04-GRAPH-003`<br/>`TC-04-GRAPH-004`<br/>`TC-04-GRAPH-006`<br/>`TC-04-GRAPH-IPC-001`<br/>`TC-04-GRAPH-IPC-002`<br/>`TC-04-GRAPH-IPC-003`<br/>`TC-04-GRAPH-008` | `TC-04-GRAPH-005`<br/>`TC-04-GRAPH-007`<br/>`TC-04-GRAPH-009`<br/>`TC-04-GRAPH-010`<br/>`TC-04-GRAPH-011` |
| `REQ-04-RULE-001` | — | `TC-04-E2E-001` | `TC-04-IPC-LINK-001` |
| `REQ-04-RULE-002` | — | `TC-04-E2E-005` | `TC-04-RUST-006` |
| `REQ-04-RULE-003` | `src/features/hasm/api.js:82` saveEntityDetail<br/>`src-tauri/src/hasm/service.rs:167` save_model_database | `TC-04-RUST-016`<br/>`TC-04-E2E-002` | `TC-04-RUST-007` |
| `REQ-04-RULE-004` | — | `TC-04-RUST-013` | `TC-04-REACT-INLINE-004`<br/>`TC-04-REACT-005`<br/>`TC-04-RUST-007` |
| `REQ-04-RULE-005` | — | `TC-04-E2E-002`<br/>`TC-04-RUST-008` | `TC-04-REACT-REF-006`<br/>`TC-NAV-EDIT-002`<br/>`TC-04-REACT-LINK-006` |
| `REQ-04-RULE-006` | — | `TC-04-RUST-013` | `TC-04-RUST-014`<br/>`TC-04-RUST-002` |
| `REQ-04-RULE-007` | `src/features/hasm/api.js:166` checkEntityMtime<br/>`src-tauri/src/hasm/entity_editor_commands.rs:24` check_entity_mtime | `TC-04-REACT-PERF-002`<br/>`TC-04-RUST-PERF-002`<br/>`TC-04-RUST-012`<br/>`TC-04-E2E-005` | `TC-04-IPC-DATA-002`<br/>`TC-04-RUST-009` |
| `REQ-04-RULE-008` | `src-tauri/src/hasm/commands.rs:20` get_person_detail<br/>`src-tauri/src/hasm/commands.rs:27` get_experience_detail<br/>`src-tauri/src/hasm/commands.rs:37` get_fact_detail<br/>`src-tauri/src/hasm/commands.rs:44` get_link_detail<br/>`src-tauri/src/hasm/commands.rs:51` save_person_detail<br/>`src-tauri/src/hasm/commands.rs:58` save_experience_detail<br/>`src-tauri/src/hasm/commands.rs:68` save_fact_detail<br/>`src-tauri/src/hasm/commands.rs:75` save_link_detail<br/>`src-tauri/src/hasm/service.rs:220` get_person_detail<br/>`src-tauri/src/hasm/service.rs:274` get_experience_detail<br/>`src-tauri/src/hasm/service.rs:342` get_fact_detail<br/>`src-tauri/src/hasm/service.rs:400` get_link_detail<br/>`src-tauri/src/hasm/service.rs:452` save_person_detail<br/>`src-tauri/src/hasm/service.rs:478` save_experience_detail<br/>`src-tauri/src/hasm/service.rs:504` save_fact_detail<br/>`src-tauri/src/hasm/service.rs:530` save_link_detail | `TC-04-RUST-PERF-001` | `TC-04-RUST-011` |
| `REQ-04-RULE-009` | — | `TC-NAV-EDIT-001`<br/>`TC-04-REACT-PERF-001` | `TC-04-REACT-LINK-006` |
| `REQ-04-RULE-010` | `src/features/entityTicket/ExternalLinksEditor.jsx:101` ExternalLinksEditor<br/>`src/features/hasm/api.js:63` openHasmModel<br/>`src/features/hasm/api.js:69` getEntityDetail<br/>`src/features/hasm/api.js:82` saveEntityDetail<br/>`src/features/hasm/api.js:134` createPerson<br/>`src/features/hasm/api.js:140` createExperience<br/>`src/features/hasm/api.js:146` createFact<br/>`src/features/hasm/api.js:152` createLink<br/>`src/pages/EntityCreatePage.jsx:26` EntityCreatePage<br/>`src-tauri/src/hasm/commands.rs:20` get_person_detail<br/>`src-tauri/src/hasm/commands.rs:27` get_experience_detail<br/>`src-tauri/src/hasm/commands.rs:37` get_fact_detail<br/>`src-tauri/src/hasm/commands.rs:44` get_link_detail<br/>`src-tauri/src/hasm/commands.rs:51` save_person_detail<br/>`src-tauri/src/hasm/commands.rs:58` save_experience_detail<br/>`src-tauri/src/hasm/commands.rs:68` save_fact_detail<br/>`src-tauri/src/hasm/commands.rs:75` save_link_detail<br/>`src-tauri/src/hasm/commands.rs:81` read_model_database<br/>`src-tauri/src/hasm/commands.rs:87` save_model_database<br/>`src-tauri/src/hasm/definitions/experience.rs:14` Experience<br/>`src-tauri/src/hasm/definitions/fact.rs:14` Fact<br/>`src-tauri/src/hasm/definitions/link.rs:14` Link<br/>`src-tauri/src/hasm/definitions/mod.rs:19` validate_external_links<br/>`src-tauri/src/hasm/definitions/person.rs:14` Person<br/>`src-tauri/src/hasm/service.rs:167` save_model_database<br/>`src-tauri/src/hasm/service.rs:220` get_person_detail<br/>`src-tauri/src/hasm/service.rs:274` get_experience_detail<br/>`src-tauri/src/hasm/service.rs:342` get_fact_detail<br/>`src-tauri/src/hasm/service.rs:400` get_link_detail<br/>`src-tauri/src/hasm/service.rs:452` save_person_detail<br/>`src-tauri/src/hasm/service.rs:478` save_experience_detail<br/>`src-tauri/src/hasm/service.rs:504` save_fact_detail<br/>`src-tauri/src/hasm/service.rs:530` save_link_detail<br/>`src-tauri/src/hasm/types.rs:210` CreatePersonRequest<br/>`src-tauri/src/hasm/types.rs:225` CreateExperienceRequest<br/>`src-tauri/src/hasm/types.rs:238` CreateFactRequest<br/>`src-tauri/src/hasm/types.rs:253` CreateLinkRequest | `TC-04-REACT-LINK-001`<br/>`TC-04-IPC-LINK-002`<br/>`TC-04-RUST-LINK-001` | `TC-04-REACT-LINK-006`<br/>`TC-04-IPC-LINK-001` |
| `REQ-04-RULE-011` | `src/features/entityTicket/ExternalLinksEditor.jsx:9` isExternalUrl<br/>`src/pages/EntityCreatePage.jsx:26` EntityCreatePage<br/>`src-tauri/src/hasm/commands.rs:51` save_person_detail<br/>`src-tauri/src/hasm/commands.rs:58` save_experience_detail<br/>`src-tauri/src/hasm/commands.rs:68` save_fact_detail<br/>`src-tauri/src/hasm/commands.rs:75` save_link_detail<br/>`src-tauri/src/hasm/definitions/experience.rs:51` verify<br/>`src-tauri/src/hasm/definitions/fact.rs:52` verify<br/>`src-tauri/src/hasm/definitions/link.rs:54` verify<br/>`src-tauri/src/hasm/definitions/mod.rs:19` validate_external_links<br/>`src-tauri/src/hasm/definitions/person.rs:55` verify<br/>`src-tauri/src/hasm/service.rs:167` save_model_database<br/>`src-tauri/src/hasm/service.rs:452` save_person_detail<br/>`src-tauri/src/hasm/service.rs:478` save_experience_detail<br/>`src-tauri/src/hasm/service.rs:504` save_fact_detail<br/>`src-tauri/src/hasm/service.rs:530` save_link_detail | `TC-04-RUST-LINK-003` | `TC-04-REACT-LINK-002`<br/>`TC-04-REACT-LINK-004`<br/>`TC-04-IPC-LINK-001`<br/>`TC-04-RUST-LINK-002` |
| `REQ-04-RULE-012` | `src/features/entityTicket/ExternalLinksEditor.jsx:21` externalLinkSite<br/>`src/features/entityTicket/ExternalLinksEditor.jsx:53` ExternalLinkPreview<br/>`src/features/entityTicket/ExternalLinksEditor.jsx:78` ExternalLinksView<br/>`src/features/entityTicket/ExternalLinksEditor.jsx:101` ExternalLinksEditor | `TC-04-REACT-LINK-001`<br/>`TC-04-REACT-LINK-005`<br/>`TC-04-REACT-LINK-001`<br/>`TC-04-REACT-LINK-005` | `TC-04-REACT-LINK-002`<br/>`TC-04-REACT-LINK-003`<br/>`TC-04-REACT-LINK-004` |
| `REQ-04-RULE-013` | `src/pages/EntityDetailPage.jsx:49` EntityDetailPage | `TC-NAV-008`<br/>`TC-NAV-002`<br/>`TC-NAV-008` | `TC-NAV-003`<br/>`TC-NAV-011`<br/>`TC-NAV-EDIT-001`<br/>`TC-NAV-003`<br/>`TC-NAV-012` |
| `REQ-04-RULE-014` | `src/features/entityTicket/MarkdownPanel.jsx:19` MarkdownPanel | `TC-04-REACT-PREVIEW-001`<br/>`TC-04-REACT-LINK-005` | `TC-04-REACT-PREVIEW-002`<br/>`TC-04-REACT-PREVIEW-003` |
| `REQ-04-RULE-015` | `src/pages/EntityDetailPage.jsx:49` EntityDetailPage | `TC-04-REACT-INLINE-001`<br/>`TC-04-REACT-INLINE-005`<br/>`TC-NAV-002` | `TC-04-REACT-INLINE-006` |
| `REQ-04-RULE-016` | `src/features/entityTicket/ExternalLinksEditor.jsx:78` ExternalLinksView<br/>`src/features/entityTicket/TicketForm.jsx:46` TicketForm<br/>`src/features/hasm/api.js:82` saveEntityDetail<br/>`src-tauri/src/hasm/commands.rs:51` save_person_detail<br/>`src-tauri/src/hasm/commands.rs:58` save_experience_detail<br/>`src-tauri/src/hasm/commands.rs:68` save_fact_detail<br/>`src-tauri/src/hasm/commands.rs:75` save_link_detail | `TC-04-REACT-INLINE-002`<br/>`TC-04-REACT-INLINE-003`<br/>`TC-04-REACT-INLINE-005`<br/>`TC-04-REACT-LINK-001`<br/>`TC-NAV-INLINE-001` | `TC-04-REACT-INLINE-004`<br/>`TC-04-REACT-INLINE-006` |
| `REQ-04-RULE-017` | `src/components/DateInput.jsx:7` DateInput<br/>`src/features/entityCreation/components/ExperienceSelect.jsx:11` ExperienceSelect<br/>`src/features/entityTicket/TicketForm.jsx:11` DETAIL_FIELDS<br/>`src/features/entityTicket/TicketForm.jsx:36` createDetailsDraft<br/>`src/features/entityTicket/TicketForm.jsx:46` TicketForm<br/>`src-tauri/src/hasm/commands.rs:51` save_person_detail<br/>`src-tauri/src/hasm/commands.rs:58` save_experience_detail<br/>`src-tauri/src/hasm/commands.rs:68` save_fact_detail<br/>`src-tauri/src/hasm/commands.rs:75` save_link_detail | `TC-04-IPC-DATE-001`<br/>`TC-04-REACT-TIME-001`<br/>`TC-04-REACT-INLINE-003`<br/>`TC-04-IPC-PICKER-001`<br/>`TC-04-IPC-INLINE-001` | `TC-04-IPC-DATE-002`<br/>`TC-04-REACT-DISPLAY-002`<br/>`TC-04-REACT-INLINE-004`<br/>`TC-04-IPC-PICKER-002` |
| `REQ-04-RULE-018` | `src/features/entityTicket/EntityReferences.js:12` createEntityReferenceIndex<br/>`src/features/entityTicket/EntityReferences.js:32` entityReferenceTitle<br/>`src/features/entityTicket/EntityReferences.js:50` detailEntityReferences<br/>`src/features/entityTicket/EntityReferences.js:67` detailDisplayValue<br/>`src-tauri/src/hasm/definitions/experience.rs:35` title<br/>`src-tauri/src/hasm/definitions/experience.rs:44` subtitle<br/>`src-tauri/src/hasm/definitions/fact.rs:36` title<br/>`src-tauri/src/hasm/definitions/fact.rs:45` subtitle<br/>`src-tauri/src/hasm/definitions/link.rs:34` title<br/>`src-tauri/src/hasm/definitions/link.rs:43` subtitle<br/>`src-tauri/src/hasm/definitions/person.rs:35` title<br/>`src-tauri/src/hasm/definitions/person.rs:44` subtitle | `TC-04-REACT-REF-009`<br/>`TC-04-REACT-REF-001`<br/>`TC-04-REACT-REF-010`<br/>`TC-NAV-REF-001` | `TC-04-REACT-REF-003` |
| `REQ-04-RULE-019` | `src/features/entityTicket/EntityReferences.js:12` createEntityReferenceIndex<br/>`src/features/entityTicket/EntityReferences.js:76` relatedLinkIds | `TC-04-REACT-REF-002`<br/>`TC-04-REACT-REF-005`<br/>`TC-NAV-REF-001` | `TC-04-REACT-REF-003`<br/>`TC-04-REACT-REF-004`<br/>`TC-04-REACT-REF-006` |
| `REQ-04-RULE-020` | `src/features/entityTicket/EntityReferences.js:50` detailEntityReferences | `TC-04-REACT-REF-010`<br/>`TC-04-REACT-REF-007`<br/>`TC-NAV-REF-002` | `TC-04-REACT-REF-008` |
| `REQ-04-RULE-021` | `src/features/entityTicket/ticketLanguage.js:121` translateTicket | `TC-04-REACT-DISPLAY-001`<br/>`TC-04-REACT-DISPLAY-004`<br/>`TC-NAV-DISPLAY-001` | `TC-04-IPC-DATE-002`<br/>`TC-04-REACT-DISPLAY-002` |
| `REQ-04-RULE-022` | — | `TC-04-REACT-DISPLAY-003`<br/>`TC-NAV-DISPLAY-001` | `TC-04-REACT-DISPLAY-005` |
| `REQ-04-RULE-026` | — | `TC-04-REACT-DISPLAY-004` | `TC-04-REACT-DISPLAY-005` |
| `REQ-04-RULE-027` | `src/features/entityCreation/components/EntityPicker.jsx:8` EntityPicker<br/>`src/features/entityCreation/components/ExperienceSelect.jsx:11` ExperienceSelect<br/>`src/features/entityCreation/components/LinkEntitySelect.jsx:7` LinkEntitySelect<br/>`src/features/entityTicket/EntityInfoPreview.jsx:49` dismissEntityPreview<br/>`src/features/entityTicket/EntityInfoPreview.jsx:55` previewGraphEntity<br/>`src/features/entityTicket/EntityInfoPreview.jsx:112` EntityInfoPreview<br/>`src/features/hasm/api.js:164` loadEntityDetail | `TC-04-PREVIEW-001`<br/>`TC-04-PREVIEW-002`<br/>`TC-04-PREVIEW-006`<br/>`TC-04-PREVIEW-POS-001`<br/>`TC-04-PREVIEW-POS-002`<br/>`TC-08-PREVIEW-001`<br/>`TC-08-PREVIEW-002`<br/>`TC-03-VIEW-PREVIEW-001` | `TC-04-PREVIEW-003`<br/>`TC-04-PREVIEW-004`<br/>`TC-04-PREVIEW-005`<br/>`TC-04-PREVIEW-007`<br/>`TC-04-PREVIEW-008`<br/>`TC-08-PREVIEW-003` |
| `REQ-04-DATA-001` | — | `TC-04-IPC-DATA-001`<br/>`TC-04-RUST-001` | `TC-04-IPC-DATA-002` |
| `REQ-04-DATA-002` | `src-tauri/src/hasm/entity_editor_commands.rs:10` load_entity_detail<br/>`src-tauri/src/hasm/types.rs:128` EntityDetailPayload | `TC-04-RUST-010`<br/>`TC-04-IPC-DATA-001` | `TC-04-IPC-DATA-002` |
| `REQ-04-DATA-003` | — | `TC-04-IPC-INLINE-001`<br/>`TC-04-IPC-DATA-001` | `TC-04-IPC-LINK-001`<br/>`TC-04-IPC-DATA-002` |
| `REQ-04-DATA-004` | — | `TC-04-IPC-DATA-001` | `TC-04-IPC-DATA-002` |
| `REQ-04-DATA-005` | `src-tauri/src/hasm/entity_editor_commands.rs:24` check_entity_mtime<br/>`src-tauri/src/hasm/types.rs:141` CheckMtimePayload | `TC-04-RUST-017`<br/>`TC-04-IPC-DATA-001`<br/>`TC-04-RUST-001` | `TC-04-IPC-DATA-002` |
| `REQ-04-DATA-006` | — | `TC-04-IPC-DATA-001` | `TC-04-IPC-DATA-002` |
| `REQ-04-DATA-007` | — | `TC-04-IPC-DATA-001`<br/>`TC-04-RUST-001` | `TC-04-IPC-DATA-002` |
| `REQ-04-DATA-008` | — | `TC-04-RUST-001` | `TC-04-RUST-011`<br/>`TC-04-IPC-DATA-002` |
| `REQ-04-FUNC-101` | `src/pages/EntityDetailPage.jsx:49` EntityDetailPage | `TC-NAV-002`<br/>`TC-04-E2E-001`<br/>`TC-04-REACT-001` | `TC-04-REACT-012` |
| `REQ-04-FUNC-102` | `src/pages/EntityDetailPage.jsx:49` EntityDetailPage | `TC-04-REACT-001` | `TC-04-REACT-002` |
| `REQ-04-FUNC-103` | `src/features/hasm/api.js:164` loadEntityDetail<br/>`src-tauri/src/hasm/entity_editor_commands.rs:10` load_entity_detail<br/>`src-tauri/src/hasm/service.rs:220` get_person_detail<br/>`src-tauri/src/hasm/service.rs:274` get_experience_detail<br/>`src-tauri/src/hasm/service.rs:342` get_fact_detail<br/>`src-tauri/src/hasm/service.rs:400` get_link_detail | `TC-04-RUST-010` | `TC-04-RUST-011` |
| `REQ-04-FUNC-104` | `src-tauri/src/hasm/entity_editor_commands.rs:10` load_entity_detail | `TC-04-RUST-010` | `TC-04-RUST-011`<br/>`TC-04-IPC-DATA-002` |
| `REQ-04-FUNC-105` | — | `TC-04-REACT-001` | `TC-04-REACT-002` |
| `REQ-04-FUNC-106` | `src-tauri/src/hasm/entity_editor_commands.rs:10` load_entity_detail | `TC-04-RUST-010` | `TC-04-RUST-011`<br/>`TC-04-IPC-DATA-002`<br/>`TC-04-RUST-005` |
| `REQ-04-FUNC-107` | — | `TC-04-REACT-001` | `TC-04-REACT-003` |
| `REQ-04-FUNC-108` | — | `TC-04-RUST-010` | `TC-04-RUST-006` |
| `REQ-04-FUNC-109` | — | `TC-04-E2E-001` | `TC-04-RUST-006` |
| `REQ-04-FUNC-110` | — | `TC-04-RUST-010` | `TC-04-RUST-006` |
| `REQ-04-FUNC-111` | — | `TC-04-REACT-001` | `TC-04-REACT-003` |
| `REQ-04-FUNC-112` | — | `TC-04-E2E-001` | `TC-04-REACT-003` |
| `REQ-04-FUNC-113` | — | `TC-04-REACT-001` | `TC-04-REACT-003` |
| `REQ-04-FUNC-114` | `src/features/hasm/api.js:164` loadEntityDetail<br/>`src-tauri/src/hasm/entity_editor_commands.rs:10` load_entity_detail<br/>`src-tauri/src/hasm/types.rs:128` EntityDetailPayload | `TC-04-RUST-010`<br/>`TC-04-E2E-001` | `TC-04-RUST-011` |
| `REQ-04-FUNC-115` | `src/pages/EntityDetailPage.jsx:49` EntityDetailPage | `TC-04-E2E-001`<br/>`TC-04-REACT-001` | `TC-04-REACT-002`<br/>`TC-04-REACT-003` |
| `REQ-04-FUNC-201` | — | `TC-NAV-EDIT-001` | `TC-04-REACT-004` |
| `REQ-04-FUNC-202` | `src-tauri/src/hasm/definitions/experience.rs:51` verify<br/>`src-tauri/src/hasm/definitions/fact.rs:52` verify<br/>`src-tauri/src/hasm/definitions/link.rs:54` verify<br/>`src-tauri/src/hasm/definitions/person.rs:55` verify | `TC-04-RUST-015` | `TC-04-RUST-014`<br/>`TC-04-RUST-002` |
| `REQ-04-FUNC-203` | `src-tauri/src/hasm/definitions/fact.rs:52` verify | `TC-04-RUST-015` | `TC-04-RUST-014`<br/>`TC-04-RUST-002` |
| `REQ-04-FUNC-204` | `src-tauri/src/hasm/definitions/link.rs:54` verify | `TC-04-RUST-015` | `TC-04-RUST-014`<br/>`TC-04-RUST-003` |
| `REQ-04-FUNC-205` | `src-tauri/src/hasm/definitions/experience.rs:51` verify<br/>`src-tauri/src/hasm/definitions/fact.rs:52` verify<br/>`src-tauri/src/hasm/definitions/person.rs:55` verify | `TC-04-RUST-015` | `TC-04-RUST-014`<br/>`TC-04-RUST-004` |
| `REQ-04-FUNC-206` | — | `TC-04-RUST-015` | `TC-04-RUST-014`<br/>`TC-04-REACT-004`<br/>`TC-04-RUST-004` |
| `REQ-04-FUNC-207` | — | `TC-NAV-EDIT-001` | `TC-04-REACT-004` |
| `REQ-04-FUNC-208` | — | `TC-04-RUST-016` | `TC-04-RUST-007` |
| `REQ-04-FUNC-209` | — | `TC-04-RUST-013` | `TC-04-REACT-005`<br/>`TC-04-RUST-007` |
| `REQ-04-FUNC-210` | — | `TC-NAV-EDIT-001` | `TC-04-REACT-005` |
| `REQ-04-FUNC-211` | — | `TC-04-RUST-013` | `TC-04-REACT-005` |
| `REQ-04-FUNC-212` | — | `TC-NAV-EDIT-001`<br/>`TC-04-E2E-002`<br/>`TC-04-RUST-008` | `TC-04-REACT-REF-006`<br/>`TC-NAV-EDIT-002`<br/>`TC-04-REACT-LINK-006` |
| `REQ-04-FUNC-213` | `src-tauri/src/hasm/types.rs:193` SaveResult | `TC-NAV-EDIT-001`<br/>`TC-04-E2E-002` | `TC-04-REACT-005` |
| `REQ-04-FUNC-301` | — | `TC-04-REACT-INLINE-002`<br/>`TC-04-REACT-INLINE-005`<br/>`TC-04-E2E-003` | `TC-04-REACT-INLINE-004` |
| `REQ-04-FUNC-302` | — | `TC-04-E2E-003`<br/>`TC-04-REACT-006` | `TC-04-REACT-INLINE-004` |
| `REQ-04-FUNC-303` | — | `TC-04-REACT-006` | `TC-04-REACT-INLINE-004` |
| `REQ-04-FUNC-304` | — | `TC-04-REACT-INLINE-002`<br/>`TC-04-REACT-INLINE-005`<br/>`TC-04-E2E-003` | `TC-04-REACT-INLINE-004` |
| `REQ-04-FUNC-401` | — | `TC-NAV-008`<br/>`TC-04-E2E-004` | `TC-NAV-EDIT-002` |
| `REQ-04-FUNC-402` | — | `TC-NAV-008`<br/>`TC-04-E2E-004` | `TC-NAV-EDIT-002` |
| `REQ-04-FUNC-403` | — | `TC-NAV-008`<br/>`TC-04-E2E-004` | `TC-NAV-EDIT-002` |
| `REQ-04-FUNC-501` | `src/pages/EntityDetailPage.jsx:49` EntityDetailPage | `TC-04-REACT-PERF-002`<br/>`TC-04-E2E-005`<br/>`TC-04-REACT-007` | `TC-04-REACT-008` |
| `REQ-04-FUNC-502` | `src/features/hasm/api.js:166` checkEntityMtime<br/>`src-tauri/src/hasm/entity_editor_commands.rs:24` check_entity_mtime | `TC-04-RUST-PERF-002`<br/>`TC-04-RUST-012`<br/>`TC-04-RUST-017` | `TC-04-IPC-DATA-002`<br/>`TC-04-RUST-009` |
| `REQ-04-FUNC-503` | `src-tauri/src/hasm/entity_editor_commands.rs:24` check_entity_mtime<br/>`src-tauri/src/hasm/types.rs:141` CheckMtimePayload | `TC-04-RUST-012`<br/>`TC-04-E2E-005`<br/>`TC-04-REACT-011` | `TC-04-IPC-DATA-002`<br/>`TC-04-RUST-009` |
| `REQ-04-FUNC-504` | `src-tauri/src/hasm/entity_editor_commands.rs:24` check_entity_mtime<br/>`src-tauri/src/hasm/types.rs:141` CheckMtimePayload | `TC-04-RUST-017` | `TC-04-IPC-DATA-002`<br/>`TC-04-E2E-006`<br/>`TC-04-REACT-008`<br/>`TC-04-RUST-009` |
| `REQ-04-FUNC-505` | `src/features/entityTicket/MarkdownPanel.jsx:19` MarkdownPanel | `TC-04-E2E-005`<br/>`TC-04-REACT-007`<br/>`TC-04-REACT-011` | `TC-04-REACT-010` |
| `REQ-04-FUNC-506` | `src/features/entityTicket/MarkdownPanel.jsx:19` MarkdownPanel | `TC-04-REACT-011` | `TC-04-E2E-006`<br/>`TC-04-REACT-008` |
| `REQ-04-FUNC-507` | `src/features/entityTicket/MarkdownPanel.jsx:19` MarkdownPanel<br/>`src/features/hasm/api.js:168` reloadEntityMarkdown | `TC-04-E2E-005`<br/>`TC-04-REACT-011` | `TC-04-REACT-009`<br/>`TC-04-REACT-010` |
| `REQ-04-FUNC-508` | `src-tauri/src/hasm/entity_editor_commands.rs:56` reload_entity_markdown | `TC-04-RUST-017` | `TC-04-IPC-DATA-002`<br/>`TC-04-E2E-006`<br/>`TC-04-REACT-009`<br/>`TC-04-RUST-005` |
| `REQ-04-FUNC-509` | `src-tauri/src/hasm/entity_editor_commands.rs:56` reload_entity_markdown | `TC-04-E2E-005` | `TC-04-REACT-010` |
| `REQ-04-FUNC-510` | — | `TC-04-REACT-011` | `TC-04-REACT-010` |
| `REQ-04-FUNC-511` | — | `TC-04-E2E-005`<br/>`TC-04-REACT-011` | `TC-04-REACT-010` |

## docs/req/14-REQ-05_Edit_on_HASM_Markdown.md

| Requirement | Code references | Positive tests | Negative tests |
| --- | --- | --- | --- |
| `REQ-05-RULE-001` | `src-tauri/src/hasm/external_editor_commands.rs:19` launch_external_markdown_app | `TC-05-E2E-001`<br/>`TC-05-RUST-007` | `TC-05-RUST-004` |
| `REQ-05-RULE-002` | `src/features/hasm/api.js:170` launchExternalMarkdownApp<br/>`src-tauri/src/hasm/external_editor_commands.rs:19` launch_external_markdown_app | `TC-05-E2E-001`<br/>`TC-05-RUST-009` | `TC-05-RUST-010` |
| `REQ-05-RULE-003` | `src-tauri/src/hasm/external_editor_commands.rs:19` launch_external_markdown_app | `TC-05-E2E-001`<br/>`TC-05-RUST-002` | `TC-05-RUST-008` |
| `REQ-05-RULE-004` | — | `TC-05-RUST-011` | `TC-05-RUST-006`<br/>`TC-05-RUST-012` |
| `REQ-05-RULE-005` | `src-tauri/src/hasm/external_editor_commands.rs:19` launch_external_markdown_app | `TC-05-RUST-009` | `TC-05-RUST-005` |
| `REQ-05-RULE-006` | — | `TC-05-RUST-007` | `TC-05-RUST-004` |
| `REQ-05-DATA-001` | — | `TC-05-REACT-006`<br/>`TC-05-RUST-001` | `TC-05-RUST-008` |
| `REQ-05-DATA-002` | `src-tauri/src/hasm/types.rs:151` LaunchExternalAppPayload | `TC-05-RUST-001` | `TC-05-RUST-014` |
| `REQ-05-DATA-003` | — | `TC-05-RUST-001` | `TC-05-RUST-013` |
| `REQ-05-FUNC-101` | `src/features/entityTicket/MarkdownPanel.jsx:19` MarkdownPanel<br/>`src/features/hasm/api.js:170` launchExternalMarkdownApp | `TC-05-E2E-001`<br/>`TC-05-REACT-001`<br/>`TC-05-REACT-006`<br/>`TC-05-REACT-007` | `TC-05-REACT-008` |
| `REQ-05-FUNC-102` | `src-tauri/src/hasm/external_editor_commands.rs:19` launch_external_markdown_app | `TC-05-RUST-002` | `TC-05-RUST-008` |
| `REQ-05-FUNC-103` | `src-tauri/src/hasm/external_editor_commands.rs:19` launch_external_markdown_app | `TC-05-RUST-002` | `TC-05-REACT-002`<br/>`TC-05-RUST-003` |
| `REQ-05-FUNC-104` | — | `TC-05-REACT-009` | `TC-05-REACT-002` |
| `REQ-05-FUNC-105` | `src-tauri/src/hasm/external_editor_commands.rs:19` launch_external_markdown_app | `TC-05-RUST-007` | `TC-05-RUST-004` |
| `REQ-05-FUNC-106` | `src-tauri/src/hasm/external_editor_commands.rs:19` launch_external_markdown_app | `TC-05-RUST-007` | `TC-05-E2E-003`<br/>`TC-05-REACT-003`<br/>`TC-05-RUST-004` |
| `REQ-05-FUNC-107` | — | `TC-05-REACT-009` | `TC-05-E2E-003`<br/>`TC-05-REACT-003` |
| `REQ-05-FUNC-108` | `src-tauri/src/hasm/external_editor_commands.rs:19` launch_external_markdown_app | `TC-05-RUST-002` | `TC-05-RUST-010` |
| `REQ-05-FUNC-109` | `src-tauri/src/hasm/external_editor_commands.rs:19` launch_external_markdown_app | `TC-05-RUST-009` | `TC-05-REACT-004`<br/>`TC-05-RUST-005` |
| `REQ-05-FUNC-110` | — | `TC-05-REACT-009` | `TC-05-REACT-004` |
| `REQ-05-FUNC-111` | `src-tauri/src/hasm/external_editor_commands.rs:19` launch_external_markdown_app | `TC-05-RUST-009` | `TC-05-REACT-005` |
| `REQ-05-FUNC-112` | — | `TC-05-REACT-009` | `TC-05-REACT-005` |
| `REQ-05-FUNC-113` | `src-tauri/src/hasm/external_editor_commands.rs:19` launch_external_markdown_app<br/>`src-tauri/src/hasm/types.rs:151` LaunchExternalAppPayload | `TC-05-E2E-001` | `TC-05-RUST-013` |
| `REQ-05-FUNC-114` | — | `TC-05-E2E-001`<br/>`TC-05-REACT-001`<br/>`TC-05-REACT-006` | `TC-05-REACT-010` |
| `REQ-05-FUNC-115` | — | `TC-05-E2E-002` | `TC-05-RUST-010` |

## docs/req/15-REQ-06_Error_Fallback.md

| Requirement | Code references | Positive tests | Negative tests |
| --- | --- | --- | --- |
| `REQ-06-RULE-001` | `src/pages/ErrorAppPage.jsx:8` ErrorAppPage<br/>`src/pages/ErrorModelPage.jsx:8` ErrorModelPage | `TC-06-E2E-001`<br/>`TC-06-REACT-008`<br/>`TC-06-REACT-010` | `TC-06-REACT-009`<br/>`TC-06-REACT-014`<br/>`TC-06-REACT-016`<br/>`TC-06-REACT-019`<br/>`TC-06-RUST-102`<br/>`TC-06-RUST-104`<br/>`TC-06-RUST-108`<br/>`TC-01-REACT-007`<br/>`TC-01-REACT-006`<br/>`TC-02-REACT-003`<br/>`TC-02-E2E-005` |
| `REQ-06-RULE-002` | — | `TC-06-E2E-003`<br/>`TC-06-REACT-001`<br/>`TC-06-REACT-003`<br/>`TC-06-REACT-006`<br/>`TC-06-REACT-008`<br/>`TC-06-REACT-013`<br/>`TC-06-REACT-015`<br/>`TC-06-RUST-103` | `TC-06-REACT-009`<br/>`TC-06-REACT-016`<br/>`TC-06-REACT-019`<br/>`TC-06-RUST-104` |
| `REQ-06-RULE-003` | — | `TC-06-E2E-002`<br/>`TC-06-RUST-002`<br/>`TC-06-REACT-011`<br/>`TC-06-RUST-103` | `TC-06-REACT-012` |
| `REQ-06-RULE-004` | — | `TC-06-E2E-003`<br/>`TC-06-RUST-003`<br/>`TC-06-RUST-105` | `TC-06-RUST-106` |
| `REQ-06-RULE-005` | — | `TC-06-RUST-004`<br/>`TC-06-RUST-005`<br/>`TC-06-REACT-017`<br/>`TC-06-REACT-022`<br/>`TC-06-RUST-101` | `TC-06-REACT-018`<br/>`TC-06-REACT-024`<br/>`TC-06-REACT-026`<br/>`TC-06-RUST-102` |
| `REQ-06-DATA-001` | — | `TC-06-RUST-001`<br/>`TC-06-RUST-103` | `TC-06-REACT-009` |
| `REQ-06-DATA-002` | — | `TC-06-RUST-001`<br/>`TC-06-RUST-103` | `TC-06-RUST-104` |
| `REQ-06-DATA-003` | — | `TC-06-RUST-001`<br/>`TC-06-RUST-105` | `TC-06-RUST-106` |
| `REQ-06-DATA-004` | — | `TC-06-RUST-101` | `TC-06-REACT-019`<br/>`TC-06-RUST-102` |
| `REQ-06-FUNC-101` | `src/pages/ErrorAppPage.jsx:8` ErrorAppPage | `TC-06-E2E-001`<br/>`TC-06-REACT-001`<br/>`TC-06-REACT-008` | `TC-06-REACT-009` |
| `REQ-06-FUNC-102` | `src/pages/ErrorAppPage.jsx:8` ErrorAppPage | `TC-06-E2E-001`<br/>`TC-06-RUST-004`<br/>`TC-06-REACT-010`<br/>`TC-06-REACT-011` | `TC-06-REACT-014` |
| `REQ-06-FUNC-103` | — | `TC-06-REACT-013` | `TC-06-REACT-002` |
| `REQ-06-FUNC-104` | — | `TC-06-E2E-001`<br/>`TC-06-REACT-010` | `TC-06-REACT-014` |
| `REQ-06-FUNC-105` | — | `TC-06-E2E-002`<br/>`TC-06-RUST-002`<br/>`TC-06-REACT-011` | `TC-06-REACT-012` |
| `REQ-06-FUNC-106` | — | `TC-06-RUST-006`<br/>`TC-06-RUST-107` | `TC-06-RUST-108` |
| `REQ-06-FUNC-201` | `src/pages/ErrorModelPage.jsx:8` ErrorModelPage | `TC-06-E2E-003`<br/>`TC-06-REACT-003`<br/>`TC-06-REACT-015` | `TC-06-REACT-016` |
| `REQ-06-FUNC-202` | — | `TC-06-REACT-003` | `TC-06-REACT-016` |
| `REQ-06-FUNC-203` | — | `TC-06-E2E-003`<br/>`TC-06-RUST-003`<br/>`TC-06-RUST-105` | `TC-06-RUST-106` |
| `REQ-06-FUNC-204` | — | `TC-06-E2E-003`<br/>`TC-06-REACT-004`<br/>`TC-06-REACT-022` | `TC-06-REACT-024` |
| `REQ-06-FUNC-205` | — | `TC-06-REACT-017` | `TC-06-REACT-018` |
| `REQ-06-FUNC-206` | `src/pages/ErrorModelPage.jsx:8` ErrorModelPage | `TC-06-REACT-005`<br/>`TC-06-REACT-017` | `TC-06-REACT-016` |
| `REQ-06-FUNC-301` | — | `TC-06-E2E-004`<br/>`TC-06-REACT-006` | `TC-06-REACT-019` |
| `REQ-06-FUNC-302` | — | `TC-06-E2E-004`<br/>`TC-06-REACT-020` | `TC-06-REACT-021` |
| `REQ-06-FUNC-303` | — | `TC-06-REACT-020` | `TC-06-REACT-021` |
| `REQ-06-FUNC-304` | `src/features/hasm/api.js:168` reloadEntityMarkdown | `TC-06-E2E-004`<br/>`TC-06-RUST-005`<br/>`TC-06-REACT-022`<br/>`TC-06-RUST-101` | `TC-06-REACT-024`<br/>`TC-06-RUST-102` |
| `REQ-06-FUNC-305` | — | `TC-06-REACT-023` | `TC-06-REACT-007` |
| `REQ-06-FUNC-306` | — | `TC-06-E2E-004`<br/>`TC-06-REACT-022` | `TC-06-REACT-024` |
| `REQ-06-FUNC-307` | — | `TC-06-E2E-005`<br/>`TC-06-REACT-025` | `TC-06-REACT-026` |

## docs/req/16-REQ-07_Others.md

| Requirement | Code references | Positive tests | Negative tests |
| --- | --- | --- | --- |
| `REQ-07-RULE-001` | `src/App.jsx:54` App<br/>`src/features/navigation/ProtectedRoute.jsx:20` ProtectedRoute | `TC-07-E2E-001`<br/>`TC-07-E2E-002`<br/>`TC-07-E2E-003`<br/>`TC-07-REACT-001`<br/>`TC-07-REACT-002` | `TC-07-E2E-004`<br/>`TC-07-REACT-007`<br/>`TC-07-REACT-008` |
| `REQ-07-RULE-002` | `src/features/navigation/ProtectedRoute.jsx:20` ProtectedRoute<br/>`src/pages/SelectModelPage.jsx:31` SelectModelPage | `TC-07-E2E-001`<br/>`TC-07-E2E-002`<br/>`TC-07-REACT-003` | `TC-07-REACT-004`<br/>`TC-07-REACT-007` |
| `REQ-07-RULE-003` | `src/features/hasm/api.js:111` switchWorkspaceCleanly<br/>`src/features/navigation/GlobalNavbar.jsx:14` GlobalNavbar<br/>`src-tauri/src/hasm/model_commands.rs:92` switch_workspace_cleanly | `TC-07-E2E-005`<br/>`TC-07-RUST-002`<br/>`TC-07-RUST-003`<br/>`TC-07-RUST-004` | `TC-07-RUST-005` |
| `REQ-07-RULE-004` | `src/features/navigation/GlobalNavbar.jsx:14` GlobalNavbar | `TC-07-REACT-005`<br/>`TC-07-REACT-011` | `TC-07-REACT-009` |
| `REQ-07-RULE-005` | `src/features/navigation/GlobalNavbar.jsx:14` GlobalNavbar<br/>`src/features/theme/ThemeContext.jsx:11` ThemeProvider | `TC-07-E2E-006`<br/>`TC-07-REACT-006`<br/>`TC-07-REACT-013`<br/>`TC-07-REACT-016` | `TC-07-REACT-014`<br/>`TC-07-REACT-015` |
| `REQ-07-RULE-006` | `src/features/entityCreation/components/ExperienceSelect.jsx:11` ExperienceSelect | `TC-02-REACT-THEME-001` | `TC-07-REACT-017` |
| `REQ-07-DATA-001` | — | `TC-07-RUST-001`<br/>`TC-07-RUST-004` | `TC-07-RUST-005` |
| `REQ-07-DATA-002` | — | `TC-07-REACT-016`<br/>`TC-07-RUST-001` | `TC-07-REACT-015` |
| `REQ-07-FUNC-101` | `src/features/navigation/ProtectedRoute.jsx:20` ProtectedRoute | `TC-07-E2E-001`<br/>`TC-07-REACT-001` | `TC-07-REACT-007` |
| `REQ-07-FUNC-102` | `src/features/navigation/ProtectedRoute.jsx:20` ProtectedRoute | `TC-07-E2E-001`<br/>`TC-07-REACT-001` | `TC-07-REACT-007` |
| `REQ-07-FUNC-103` | `src/features/navigation/ProtectedRoute.jsx:20` ProtectedRoute | `TC-07-E2E-002`<br/>`TC-07-REACT-002` | `TC-07-REACT-008` |
| `REQ-07-FUNC-104` | `src/features/navigation/ProtectedRoute.jsx:20` ProtectedRoute | `TC-07-E2E-002`<br/>`TC-07-REACT-002` | `TC-07-REACT-008` |
| `REQ-07-FUNC-105` | `src/pages/LoadingModelPage.jsx:45` LoadingModelPage | `TC-07-E2E-001`<br/>`TC-07-E2E-002`<br/>`TC-07-REACT-003` | `TC-07-REACT-004` |
| `REQ-07-FUNC-201` | `src/features/navigation/GlobalNavbar.jsx:14` GlobalNavbar | `TC-07-E2E-005` | `TC-07-REACT-009` |
| `REQ-07-FUNC-202` | — | `TC-07-E2E-005` | `TC-07-E2E-007` |
| `REQ-07-FUNC-203` | `src/features/hasm/api.js:111` switchWorkspaceCleanly<br/>`src/features/navigation/GlobalNavbar.jsx:14` GlobalNavbar<br/>`src-tauri/src/hasm/model_commands.rs:92` switch_workspace_cleanly | `TC-07-E2E-005`<br/>`TC-07-RUST-002`<br/>`TC-07-RUST-003`<br/>`TC-07-RUST-004` | `TC-07-REACT-010`<br/>`TC-07-RUST-005` |
| `REQ-07-FUNC-204` | `src/features/navigation/GlobalNavbar.jsx:14` GlobalNavbar | `TC-07-E2E-005` | `TC-07-REACT-010` |
| `REQ-07-FUNC-301` | `src/App.jsx:54` App<br/>`src/features/navigation/GlobalNavbar.jsx:14` GlobalNavbar<br/>`src/features/theme/ThemeContext.jsx:11` ThemeProvider<br/>`src/features/theme/ThemeContext.jsx:16` useTheme | `TC-07-E2E-006`<br/>`TC-07-REACT-006`<br/>`TC-07-REACT-013`<br/>`TC-02-REACT-THEME-001` | `TC-07-REACT-015` |
| `REQ-07-FUNC-302` | `src/features/theme/ThemeContext.jsx:16` useTheme | `TC-07-E2E-006`<br/>`TC-07-REACT-013` | `TC-07-REACT-014` |
| `REQ-07-FUNC-401` | `src/features/navigation/GlobalNavbar.jsx:14` GlobalNavbar | `TC-07-REACT-005`<br/>`TC-07-REACT-011` | `TC-07-REACT-009` |
| `REQ-07-FUNC-402` | — | `TC-07-REACT-011` | `TC-07-REACT-012` |
| `REQ-07-FUNC-403` | — | `TC-07-REACT-011` | `TC-07-REACT-012` |
| `REQ-07-FUNC-501` | `src-tauri/src/hasm/types.rs:119` TestWorkspaceFixture<br/>`src-tauri/src/hasm/visualizer_commands.rs:662` create_test_workspace_fixture | `TC-07-RUST-006` | `TC-07-RUST-007` |

## docs/req/17-REQ-08_EntityCreation.md

| Requirement | Code references | Positive tests | Negative tests |
| --- | --- | --- | --- |
| `REQ-08-001` | `src/features/hasm/api.js:35` pickWorkspaceDirectory<br/>`src/pages/SelectModelPage.jsx:31` SelectModelPage | `TC-EVL-08-E2E-001`<br/>`TC-08-E2E-001` | `TC-08-REACT-008` |
| `REQ-08-002` | `src/features/hasm/api.js:48` createHasmWorkspace<br/>`src/pages/SelectModelPage.jsx:31` SelectModelPage<br/>`src-tauri/src/hasm/entity_creation_commands.rs:24` create_hasm_workspace<br/>`src-tauri/src/hasm/types.rs:201` WorkspacePathPayload | `TC-EVL-08-E2E-001`<br/>`TC-EVL-08-RUST-002`<br/>`TC-08-E2E-001`<br/>`TC-08-RUST-101` | `TC-08-RUST-100` |
| `REQ-08-010` | `src/features/entityCreation/components/CreatePersonForm.jsx:5` CreatePersonForm<br/>`src/features/hasm/api.js:134` createPerson<br/>`src-tauri/src/hasm/definitions/person.rs:55` verify<br/>`src-tauri/src/hasm/entity_creation_commands.rs:105` create_person<br/>`src-tauri/src/hasm/types.rs:210` CreatePersonRequest | `TC-EVL-08-E2E-002`<br/>`TC-EVL-08-RUST-001`<br/>`TC-08-RUST-102` | `TC-EVL-08-COMP-001`<br/>`TC-08-RUST-103` |
| `REQ-08-011` | `src/features/entityCreation/components/CreateExperienceForm.jsx:6` CreateExperienceForm<br/>`src/features/hasm/api.js:140` createExperience<br/>`src-tauri/src/hasm/definitions/experience.rs:51` verify<br/>`src-tauri/src/hasm/entity_creation_commands.rs:121` create_experience<br/>`src-tauri/src/hasm/types.rs:225` CreateExperienceRequest | `TC-08-RUST-102`<br/>`TC-08-REACT-REL-001` | `TC-EVL-08-COMP-001`<br/>`TC-08-RUST-103` |
| `REQ-08-012` | `src/features/entityCreation/components/CreateFactForm.jsx:7` CreateFactForm<br/>`src/features/hasm/api.js:146` createFact<br/>`src-tauri/src/hasm/definitions/fact.rs:52` verify<br/>`src-tauri/src/hasm/entity_creation_commands.rs:170` create_fact<br/>`src-tauri/src/hasm/types.rs:238` CreateFactRequest | `TC-08-RUST-102`<br/>`TC-08-IPC-DATE-001` | `TC-EVL-08-COMP-002`<br/>`TC-08-RUST-103` |
| `REQ-08-013` | `src/features/entityCreation/components/CreateLinkForm.jsx:6` CreateLinkForm<br/>`src/features/hasm/api.js:152` createLink<br/>`src-tauri/src/hasm/definitions/link.rs:54` verify<br/>`src-tauri/src/hasm/entity_creation_commands.rs:180` create_link<br/>`src-tauri/src/hasm/types.rs:253` CreateLinkRequest | `TC-EVL-08-E2E-003`<br/>`TC-EVL-08-RUST-001`<br/>`TC-08-RUST-102`<br/>`TC-08-RUST-104` | `TC-EVL-08-E2E-004`<br/>`TC-EVL-08-COMP-003`<br/>`TC-08-RUST-103` |
| `REQ-08-014` | `src/features/entityCreation/components/CreateExperienceForm.jsx:6` CreateExperienceForm<br/>`src/features/entityCreation/components/CreateFactForm.jsx:7` CreateFactForm<br/>`src/features/entityCreation/components/CreateLinkForm.jsx:6` CreateLinkForm<br/>`src/features/entityCreation/components/CreatePersonForm.jsx:5` CreatePersonForm<br/>`src/pages/VisualizerPage.jsx:30` VisualizerPage | `TC-08-REACT-001`<br/>`TC-08-REACT-002` | `TC-08-REACT-003` |
| `REQ-08-015` | `src/features/hasm/api.js:134` createPerson<br/>`src/pages/ModelInitializationPage.jsx:17` ModelInitializationPage<br/>`src-tauri/src/hasm/entity_creation_commands.rs:105` create_person<br/>`src-tauri/src/hasm/types.rs:210` CreatePersonRequest | `TC-EVL-08-E2E-005` | `TC-08-REACT-006` |
| `REQ-08-022` | `src/components/DateInput.jsx:7` DateInput<br/>`src/features/entityCreation/components/CreateFactForm.jsx:7` CreateFactForm | `TC-08-IPC-DATE-001` | `TC-08-REACT-009` |
| `REQ-08-016` | `src-tauri/src/hasm/entity_creation_commands.rs:105` create_person<br/>`src-tauri/src/hasm/entity_creation_commands.rs:121` create_experience<br/>`src-tauri/src/hasm/entity_creation_commands.rs:170` create_fact<br/>`src-tauri/src/hasm/entity_creation_commands.rs:180` create_link | `TC-08-RUST-101`<br/>`TC-08-RUST-102`<br/>`TC-08-REACT-LINK-001` | `TC-04-IPC-LINK-001`<br/>`TC-08-REACT-LINK-001` |
| `REQ-08-017` | `src/features/entityCreation/components/CreateExperienceForm.jsx:6` CreateExperienceForm<br/>`src/features/entityCreation/components/CreateFactForm.jsx:7` CreateFactForm<br/>`src-tauri/src/hasm/types.rs:225` CreateExperienceRequest | `TC-08-REACT-REL-001`<br/>`TC-08-IPC-PICKER-001` | `TC-08-REACT-REL-002` |
| `REQ-08-018` | `src/features/entityCreation/components/CreateExperienceForm.jsx:6` CreateExperienceForm<br/>`src/features/entityCreation/components/CreateFactForm.jsx:7` CreateFactForm<br/>`src/features/entityCreation/components/CreateLinkForm.jsx:6` CreateLinkForm<br/>`src/features/entityCreation/components/CreatePersonForm.jsx:5` CreatePersonForm | `TC-08-REACT-LINK-001` | `TC-08-RUST-103` |
| `REQ-08-019` | `src/features/entityCreation/components/CreateLinkForm.jsx:6` CreateLinkForm<br/>`src-tauri/src/hasm/types.rs:253` CreateLinkRequest | `TC-08-REACT-SEARCH-001`<br/>`TC-08-REACT-SEARCH-003` | `TC-08-REACT-SEARCH-002` |
| `REQ-08-020` | `src-tauri/src/hasm/entity_creation_commands.rs:105` create_person<br/>`src-tauri/src/hasm/entity_creation_commands.rs:121` create_experience<br/>`src-tauri/src/hasm/entity_creation_commands.rs:170` create_fact<br/>`src-tauri/src/hasm/entity_creation_commands.rs:180` create_link<br/>`src-tauri/src/hasm/types.rs:269` EntityCreationPayload | `TC-EVL-08-E2E-002`<br/>`TC-EVL-08-RUST-003`<br/>`TC-08-RUST-102` | `TC-08-RUST-103` |
| `REQ-08-021` | `src-tauri/src/hasm/types.rs:269` EntityCreationPayload | `TC-EVL-08-E2E-002`<br/>`TC-EVL-08-E2E-003`<br/>`TC-08-REACT-002` | `TC-08-REACT-003` |
| `REQ-08-100` | `src-tauri/src/hasm/entity_creation_commands.rs:24` create_hasm_workspace | `TC-EVL-08-RUST-002`<br/>`TC-08-RUST-101` | `TC-08-RUST-100` |
| `REQ-08-101` | `src-tauri/src/hasm/entity_creation_commands.rs:105` create_person<br/>`src-tauri/src/hasm/entity_creation_commands.rs:121` create_experience<br/>`src-tauri/src/hasm/entity_creation_commands.rs:170` create_fact<br/>`src-tauri/src/hasm/entity_creation_commands.rs:180` create_link | `TC-EVL-08-RUST-003`<br/>`TC-08-RUST-102` | `TC-08-RUST-103` |
| `REQ-08-102` | `src-tauri/src/hasm/entity_creation_commands.rs:180` create_link | `TC-08-RUST-104` | `TC-EVL-08-COMP-003` |

## Code item index

| Source item | Requirements |
| --- | --- |
| `src-tauri/src/hasm/app_commands.rs:24` tauri command **validate_app_version** | `REQ-01-FUNC-302` `REQ-01-FUNC-303` `REQ-01-FUNC-304` `REQ-01-FUNC-305` `REQ-01-FUNC-306` `REQ-01-FUNC-311` |
| `src-tauri/src/hasm/app_commands.rs:43` tauri command **validate_hasm_folder_path** | `REQ-01-FUNC-402` `REQ-01-RULE-007` |
| `src-tauri/src/hasm/app_commands.rs:14` tauri command **validate_hasm_markdown_app** | `REQ-01-FUNC-202` `REQ-01-FUNC-207` |
| `src-tauri/src/hasm/commands.rs:27` tauri command **get_experience_detail** | `REQ-04-RULE-008` `REQ-04-RULE-010` |
| `src-tauri/src/hasm/commands.rs:37` tauri command **get_fact_detail** | `REQ-04-RULE-008` `REQ-04-RULE-010` |
| `src-tauri/src/hasm/commands.rs:44` tauri command **get_link_detail** | `REQ-04-RULE-008` `REQ-04-RULE-010` |
| `src-tauri/src/hasm/commands.rs:20` tauri command **get_person_detail** | `REQ-04-RULE-008` `REQ-04-RULE-010` |
| `src-tauri/src/hasm/commands.rs:13` tauri command **open_hasm_model** | `REQ-02-RULE-009` `REQ-02-FUNC-403` |
| `src-tauri/src/hasm/commands.rs:81` tauri command **read_model_database** | `REQ-04-RULE-010` |
| `src-tauri/src/hasm/commands.rs:58` tauri command **save_experience_detail** | `REQ-04-RULE-008` `REQ-04-RULE-010` `REQ-04-RULE-011` `REQ-04-RULE-016` `REQ-04-RULE-017` |
| `src-tauri/src/hasm/commands.rs:68` tauri command **save_fact_detail** | `REQ-04-RULE-008` `REQ-04-RULE-010` `REQ-04-RULE-011` `REQ-04-RULE-016` `REQ-04-RULE-017` |
| `src-tauri/src/hasm/commands.rs:75` tauri command **save_link_detail** | `REQ-04-RULE-008` `REQ-04-RULE-010` `REQ-04-RULE-011` `REQ-04-RULE-016` `REQ-04-RULE-017` |
| `src-tauri/src/hasm/commands.rs:87` tauri command **save_model_database** | `REQ-04-RULE-010` |
| `src-tauri/src/hasm/commands.rs:51` tauri command **save_person_detail** | `REQ-04-RULE-008` `REQ-04-RULE-010` `REQ-04-RULE-011` `REQ-04-RULE-016` `REQ-04-RULE-017` |
| `src-tauri/src/hasm/definitions/experience.rs:29` pub fn **default_markdown_path** | `REQ-02-FUNC-301` |
| `src-tauri/src/hasm/definitions/experience.rs:14` pub struct **Experience** | `REQ-02-FUNC-206` `REQ-02-FUNC-406` `REQ-04-RULE-010` |
| `src-tauri/src/hasm/definitions/experience.rs:44` pub fn **subtitle** | `REQ-04-RULE-018` |
| `src-tauri/src/hasm/definitions/experience.rs:35` pub fn **title** | `REQ-04-RULE-018` |
| `src-tauri/src/hasm/definitions/experience.rs:51` pub fn **verify** | `REQ-04-FUNC-202` `REQ-04-FUNC-205` `REQ-04-RULE-011` `REQ-08-011` |
| `src-tauri/src/hasm/definitions/fact.rs:30` pub fn **default_markdown_path** | `REQ-02-FUNC-301` |
| `src-tauri/src/hasm/definitions/fact.rs:14` pub struct **Fact** | `REQ-02-FUNC-206` `REQ-02-FUNC-406` `REQ-04-RULE-010` |
| `src-tauri/src/hasm/definitions/fact.rs:45` pub fn **subtitle** | `REQ-04-RULE-018` |
| `src-tauri/src/hasm/definitions/fact.rs:36` pub fn **title** | `REQ-04-RULE-018` |
| `src-tauri/src/hasm/definitions/fact.rs:52` pub fn **verify** | `REQ-04-FUNC-202` `REQ-04-FUNC-203` `REQ-04-FUNC-205` `REQ-04-RULE-011` `REQ-08-012` |
| `src-tauri/src/hasm/definitions/link.rs:28` pub fn **default_markdown_path** | `REQ-02-FUNC-301` |
| `src-tauri/src/hasm/definitions/link.rs:14` pub struct **Link** | `REQ-02-FUNC-206` `REQ-02-FUNC-406` `REQ-04-RULE-010` |
| `src-tauri/src/hasm/definitions/link.rs:43` pub fn **subtitle** | `REQ-04-RULE-018` |
| `src-tauri/src/hasm/definitions/link.rs:34` pub fn **title** | `REQ-04-RULE-018` |
| `src-tauri/src/hasm/definitions/link.rs:54` pub fn **verify** | `REQ-04-FUNC-202` `REQ-04-FUNC-204` `REQ-04-RULE-011` `REQ-08-013` |
| `src-tauri/src/hasm/definitions/mod.rs:19` pub fn **validate_external_links** | `REQ-04-RULE-011` `REQ-04-RULE-010` |
| `src-tauri/src/hasm/definitions/person.rs:29` pub fn **default_markdown_path** | `REQ-02-FUNC-301` |
| `src-tauri/src/hasm/definitions/person.rs:14` pub struct **Person** | `REQ-02-FUNC-206` `REQ-02-FUNC-406` `REQ-04-RULE-010` |
| `src-tauri/src/hasm/definitions/person.rs:44` pub fn **subtitle** | `REQ-04-RULE-018` |
| `src-tauri/src/hasm/definitions/person.rs:35` pub fn **title** | `REQ-04-RULE-018` |
| `src-tauri/src/hasm/definitions/person.rs:55` pub fn **verify** | `REQ-04-FUNC-202` `REQ-04-FUNC-205` `REQ-04-RULE-011` `REQ-08-010` |
| `src-tauri/src/hasm/entity_creation_commands.rs:121` tauri command **create_experience** | `REQ-08-011` `REQ-08-016` `REQ-08-020` `REQ-08-101` |
| `src-tauri/src/hasm/entity_creation_commands.rs:170` tauri command **create_fact** | `REQ-08-012` `REQ-08-016` `REQ-08-020` `REQ-08-101` |
| `src-tauri/src/hasm/entity_creation_commands.rs:24` tauri command **create_hasm_workspace** | `REQ-08-002` `REQ-08-100` `REQ-01-RULE-008` `REQ-02-FUNC-107` |
| `src-tauri/src/hasm/entity_creation_commands.rs:180` tauri command **create_link** | `REQ-08-013` `REQ-08-016` `REQ-08-020` `REQ-08-101` `REQ-08-102` |
| `src-tauri/src/hasm/entity_creation_commands.rs:105` tauri command **create_person** | `REQ-08-010` `REQ-08-015` `REQ-08-016` `REQ-08-020` `REQ-08-101` |
| `src-tauri/src/hasm/entity_deletion_commands.rs:66` tauri command **delete_entity** | `REQ-04-RULE-028` `REQ-04-RULE-029` |
| `src-tauri/src/hasm/entity_deletion_commands.rs:17` pub struct **DeleteRequest** | `REQ-04-RULE-028` `REQ-04-RULE-029` |
| `src-tauri/src/hasm/entity_deletion_commands.rs:44` pub struct **DeleteResult** | `REQ-04-RULE-029` |
| `src-tauri/src/hasm/entity_editor_commands.rs:24` tauri command **check_entity_mtime** | `REQ-04-RULE-007` `REQ-04-FUNC-502` `REQ-04-FUNC-503` `REQ-04-FUNC-504` `REQ-04-DATA-005` |
| `src-tauri/src/hasm/entity_editor_commands.rs:10` tauri command **load_entity_detail** | `REQ-04-FUNC-103` `REQ-04-FUNC-104` `REQ-04-FUNC-106` `REQ-04-FUNC-114` `REQ-04-DATA-002` |
| `src-tauri/src/hasm/entity_editor_commands.rs:56` tauri command **reload_entity_markdown** | `REQ-04-FUNC-508` `REQ-04-FUNC-509` |
| `src-tauri/src/hasm/external_editor_commands.rs:19` tauri command **launch_external_markdown_app** | `REQ-05-RULE-001` `REQ-05-RULE-002` `REQ-05-RULE-003` `REQ-05-RULE-005` `REQ-05-FUNC-102` `REQ-05-FUNC-103` `REQ-05-FUNC-105` `REQ-05-FUNC-106` `REQ-05-FUNC-108` `REQ-05-FUNC-109` `REQ-05-FUNC-111` `REQ-05-FUNC-113` |
| `src-tauri/src/hasm/model_commands.rs:25` tauri command **check_workspace_lock** | `REQ-02-FUNC-103` `REQ-02-FUNC-105` `REQ-02-FUNC-107` `REQ-02-FUNC-110` `REQ-02-FUNC-409` `REQ-02-RULE-002` `REQ-02-RULE-010` `REQ-02-RULE-015` |
| `src-tauri/src/hasm/model_commands.rs:104` tauri command **load_hasm_model_db** | `REQ-02-FUNC-202` `REQ-02-FUNC-206` `REQ-02-FUNC-406` `REQ-02-FUNC-410` `REQ-02-RULE-008` `REQ-02-RULE-015` |
| `src-tauri/src/hasm/model_commands.rs:80` tauri command **release_workspace_lock** | `REQ-02-RULE-003` `REQ-02-FUNC-109` |
| `src-tauri/src/hasm/model_commands.rs:92` tauri command **switch_workspace_cleanly** | `REQ-07-RULE-003` `REQ-07-FUNC-203` |
| `src-tauri/src/hasm/model_commands.rs:154` tauri command **verify_hasm_storage** | `REQ-02-FUNC-301` `REQ-02-FUNC-303` `REQ-02-FUNC-304` `REQ-02-FUNC-408` `REQ-02-RULE-006` `REQ-02-RULE-015` |
| `src-tauri/src/hasm/service.rs:274` pub fn **get_experience_detail** | `REQ-04-FUNC-103` `REQ-04-RULE-008` `REQ-04-RULE-010` |
| `src-tauri/src/hasm/service.rs:342` pub fn **get_fact_detail** | `REQ-04-FUNC-103` `REQ-04-RULE-008` `REQ-04-RULE-010` |
| `src-tauri/src/hasm/service.rs:400` pub fn **get_link_detail** | `REQ-04-FUNC-103` `REQ-04-RULE-008` `REQ-04-RULE-010` |
| `src-tauri/src/hasm/service.rs:220` pub fn **get_person_detail** | `REQ-04-FUNC-103` `REQ-04-RULE-008` `REQ-04-RULE-010` |
| `src-tauri/src/hasm/service.rs:23` pub fn **open_hasm_model** | `REQ-02-RULE-009` `REQ-02-FUNC-403` `REQ-02-FUNC-405` |
| `src-tauri/src/hasm/service.rs:78` pub fn **read_model_database** | `REQ-02-FUNC-206` `REQ-02-FUNC-207` |
| `src-tauri/src/hasm/service.rs:86` pub fn **read_model_database_with_progress** | `REQ-02-FUNC-206` `REQ-02-FUNC-406` `REQ-02-RULE-008` |
| `src-tauri/src/hasm/service.rs:99` pub fn **read_model_database_with_stage_progress** | `REQ-02-FUNC-206` `REQ-02-FUNC-410` `REQ-02-RULE-013` |
| `src-tauri/src/hasm/service.rs:478` pub fn **save_experience_detail** | `REQ-04-RULE-008` `REQ-04-RULE-010` `REQ-04-RULE-011` |
| `src-tauri/src/hasm/service.rs:504` pub fn **save_fact_detail** | `REQ-04-RULE-008` `REQ-04-RULE-010` `REQ-04-RULE-011` |
| `src-tauri/src/hasm/service.rs:530` pub fn **save_link_detail** | `REQ-04-RULE-008` `REQ-04-RULE-010` `REQ-04-RULE-011` |
| `src-tauri/src/hasm/service.rs:167` pub fn **save_model_database** | `REQ-04-RULE-003` `REQ-04-RULE-010` `REQ-04-RULE-011` |
| `src-tauri/src/hasm/service.rs:452` pub fn **save_person_detail** | `REQ-04-RULE-008` `REQ-04-RULE-010` `REQ-04-RULE-011` |
| `src-tauri/src/hasm/splash_commands.rs:86` tauri command **complete_app_launch** | `REQ-01-DATA-003` `REQ-01-FUNC-003` `REQ-01-FUNC-004` |
| `src-tauri/src/hasm/splash_commands.rs:31` pub fn **new** | `REQ-01-FUNC-003` |
| `src-tauri/src/hasm/splash_commands.rs:52` pub fn **remaining_splash_delay** | `REQ-01-RULE-009` `REQ-01-FUNC-003` |
| `src-tauri/src/hasm/splash_commands.rs:123` pub fn **show_main_window** | `REQ-01-FUNC-003` `REQ-01-DATA-003` |
| `src-tauri/src/hasm/splash_commands.rs:24` pub struct **SplashState** | `REQ-01-FUNC-003` `REQ-01-FUNC-004` |
| `src-tauri/src/hasm/splash_commands.rs:59` pub fn **start_splash_fallback** | `REQ-01-FUNC-005` `REQ-01-RULE-009` |
| `src-tauri/src/hasm/types.rs:14` pub struct **AppValidationError** | `REQ-01-DATA-001` |
| `src-tauri/src/hasm/types.rs:22` pub struct **AppVersionResponse** | `REQ-01-DATA-002` |
| `src-tauri/src/hasm/types.rs:141` pub struct **CheckMtimePayload** | `REQ-04-DATA-005` `REQ-04-FUNC-503` `REQ-04-FUNC-504` |
| `src-tauri/src/hasm/types.rs:225` pub struct **CreateExperienceRequest** | `REQ-04-RULE-010` `REQ-08-011` `REQ-08-017` |
| `src-tauri/src/hasm/types.rs:238` pub struct **CreateFactRequest** | `REQ-04-RULE-010` `REQ-08-012` |
| `src-tauri/src/hasm/types.rs:253` pub struct **CreateLinkRequest** | `REQ-04-RULE-010` `REQ-08-013` `REQ-08-019` |
| `src-tauri/src/hasm/types.rs:210` pub struct **CreatePersonRequest** | `REQ-04-RULE-010` `REQ-08-010` `REQ-08-015` |
| `src-tauri/src/hasm/types.rs:269` pub struct **EntityCreationPayload** | `REQ-08-020` `REQ-08-021` |
| `src-tauri/src/hasm/types.rs:128` pub struct **EntityDetailPayload** | `REQ-04-DATA-002` `REQ-04-FUNC-114` |
| `src-tauri/src/hasm/types.rs:161` pub struct **EntitySummary** | `REQ-02-DATA-007` |
| `src-tauri/src/hasm/types.rs:151` pub struct **LaunchExternalAppPayload** | `REQ-05-DATA-002` `REQ-05-FUNC-113` |
| `src-tauri/src/hasm/types.rs:63` pub struct **LayoutFilterRequest** | `REQ-03-DATA-001` |
| `src-tauri/src/hasm/types.rs:92` pub struct **Line3dGeometry** | `REQ-03-DATA-003` |
| `src-tauri/src/hasm/types.rs:32` pub struct **LockStatus** | `REQ-02-DATA-002` |
| `src-tauri/src/hasm/types.rs:182` pub struct **ModelDatabase** | `REQ-02-FUNC-207` `REQ-02-RULE-008` |
| `src-tauri/src/hasm/types.rs:171` pub struct **ModelWorkspace** | `REQ-02-DATA-006` |
| `src-tauri/src/hasm/types.rs:71` pub struct **Node3dGeometry** | `REQ-03-DATA-003` |
| `src-tauri/src/hasm/types.rs:43` pub struct **ProgressPayload** | `REQ-02-DATA-004` |
| `src-tauri/src/hasm/types.rs:108` pub struct **RenderPayload** | `REQ-03-DATA-003` |
| `src-tauri/src/hasm/types.rs:193` pub struct **SaveResult** | `REQ-04-FUNC-213` |
| `src-tauri/src/hasm/types.rs:119` pub struct **TestWorkspaceFixture** | `REQ-07-FUNC-501` |
| `src-tauri/src/hasm/types.rs:55` pub struct **VerificationResult** | `REQ-02-FUNC-301` `REQ-02-RULE-006` |
| `src-tauri/src/hasm/types.rs:201` pub struct **WorkspacePathPayload** | `REQ-08-002` |
| `src-tauri/src/hasm/visualizer_commands.rs:19` tauri command **compute_visualizer_layout** | `REQ-03-RULE-001` `REQ-03-RULE-002` `REQ-03-RULE-006` `REQ-03-RULE-007` `REQ-03-RULE-012` `REQ-03-FUNC-105` `REQ-03-FUNC-303` `REQ-03-FUNC-306` |
| `src-tauri/src/hasm/visualizer_commands.rs:662` pub fn **create_test_workspace_fixture** | `REQ-07-FUNC-501` `REQ-03-RULE-019` |
| `src-tauri/src/lib.rs:19` pub fn **run** | `REQ-01-FUNC-001` `REQ-01-RULE-009` |
| `src/App.jsx:54` default export **App** | `REQ-07-RULE-001` `REQ-07-FUNC-301` `REQ-02-RULE-003` `REQ-02-FUNC-108` `REQ-02-FUNC-109` |
| `src/components/DateInput.jsx:7` function **DateInput** | `REQ-04-RULE-017` `REQ-08-022` |
| `src/features/entityCreation/components/CreateExperienceForm.jsx:6` default export **CreateExperienceForm** | `REQ-08-011` `REQ-08-014` `REQ-08-017` `REQ-08-018` |
| `src/features/entityCreation/components/CreateFactForm.jsx:7` default export **CreateFactForm** | `REQ-08-012` `REQ-08-014` `REQ-08-017` `REQ-08-018` `REQ-08-022` |
| `src/features/entityCreation/components/CreateLinkForm.jsx:6` default export **CreateLinkForm** | `REQ-08-013` `REQ-08-014` `REQ-08-018` `REQ-08-019` |
| `src/features/entityCreation/components/CreatePersonForm.jsx:5` default export **CreatePersonForm** | `REQ-08-010` `REQ-08-014` `REQ-08-018` |
| `src/features/entityCreation/components/EntityPicker.jsx:8` default export **EntityPicker** | `REQ-04-RULE-027` |
| `src/features/entityCreation/components/ExperienceSelect.jsx:11` default export **ExperienceSelect** | `REQ-04-RULE-017` `REQ-04-RULE-027` `REQ-07-RULE-006` |
| `src/features/entityCreation/components/LinkEntitySelect.jsx:7` default export **LinkEntitySelect** | `REQ-04-RULE-027` |
| `src/features/entityTicket/EntityCommitGraph.jsx:23` function **EntityCommitGraph** | `REQ-04-RULE-023` `REQ-04-RULE-024` `REQ-04-RULE-025` |
| `src/features/entityTicket/EntityDeleteDialog.jsx:8` function **EntityDeleteDialog** | `REQ-04-RULE-028` `REQ-04-RULE-029` |
| `src/features/entityTicket/entityGraphModel.js:7` function **extractEntityGraphModel** | `REQ-04-RULE-023` |
| `src/features/entityTicket/EntityInfoPreview.jsx:49` function **dismissEntityPreview** | `REQ-04-RULE-027` |
| `src/features/entityTicket/EntityInfoPreview.jsx:112` function **EntityInfoPreview** | `REQ-04-RULE-027` |
| `src/features/entityTicket/EntityInfoPreview.jsx:55` function **previewGraphEntity** | `REQ-04-RULE-027` |
| `src/features/entityTicket/EntityReferences.js:12` function **createEntityReferenceIndex** | `REQ-04-RULE-018` `REQ-04-RULE-019` |
| `src/features/entityTicket/EntityReferences.js:67` function **detailDisplayValue** | `REQ-04-RULE-018` |
| `src/features/entityTicket/EntityReferences.js:50` function **detailEntityReferences** | `REQ-04-RULE-018` `REQ-04-RULE-020` |
| `src/features/entityTicket/EntityReferences.js:32` function **entityReferenceTitle** | `REQ-04-RULE-018` |
| `src/features/entityTicket/EntityReferences.js:76` function **relatedLinkIds** | `REQ-04-RULE-019` `REQ-04-RULE-028` |
| `src/features/entityTicket/ExternalLinksEditor.jsx:53` function **ExternalLinkPreview** | `REQ-04-RULE-012` |
| `src/features/entityTicket/ExternalLinksEditor.jsx:101` function **ExternalLinksEditor** | `REQ-04-RULE-010` `REQ-04-RULE-012` |
| `src/features/entityTicket/ExternalLinksEditor.jsx:21` function **externalLinkSite** | `REQ-04-RULE-012` |
| `src/features/entityTicket/ExternalLinksEditor.jsx:78` function **ExternalLinksView** | `REQ-04-RULE-012` `REQ-04-RULE-016` |
| `src/features/entityTicket/ExternalLinksEditor.jsx:9` function **isExternalUrl** | `REQ-04-RULE-011` |
| `src/features/entityTicket/MarkdownPanel.jsx:19` function **MarkdownPanel** | `REQ-04-RULE-014` `REQ-04-FUNC-505` `REQ-04-FUNC-506` `REQ-04-FUNC-507` `REQ-05-FUNC-101` |
| `src/features/entityTicket/TicketForm.jsx:36` function **createDetailsDraft** | `REQ-04-RULE-017` |
| `src/features/entityTicket/TicketForm.jsx:11` const **DETAIL_FIELDS** | `REQ-04-RULE-017` |
| `src/features/entityTicket/TicketForm.jsx:46` function **TicketForm** | `REQ-04-RULE-016` `REQ-04-RULE-017` |
| `src/features/entityTicket/ticketLanguage.js:121` function **translateTicket** | `REQ-04-RULE-021` |
| `src/features/hasm/api.js:41` function **browseWorkspaceDirectory** | `REQ-02-RULE-012` |
| `src/features/hasm/api.js:166` function **checkEntityMtime** | `REQ-04-RULE-007` `REQ-04-FUNC-502` |
| `src/features/hasm/api.js:100` function **checkWorkspaceLock** | `REQ-02-FUNC-101` `REQ-02-RULE-002` |
| `src/features/hasm/api.js:30` function **completeAppLaunch** | `REQ-01-FUNC-002` `REQ-01-DATA-003` |
| `src/features/hasm/api.js:128` function **computeVisualizerLayout** | `REQ-03-FUNC-201` `REQ-03-RULE-003` |
| `src/features/hasm/api.js:140` function **createExperience** | `REQ-04-RULE-010` `REQ-08-011` |
| `src/features/hasm/api.js:146` function **createFact** | `REQ-04-RULE-010` `REQ-08-012` |
| `src/features/hasm/api.js:48` function **createHasmWorkspace** | `REQ-01-RULE-008` `REQ-08-002` |
| `src/features/hasm/api.js:152` function **createLink** | `REQ-04-RULE-010` `REQ-08-013` |
| `src/features/hasm/api.js:134` function **createPerson** | `REQ-04-RULE-010` `REQ-08-010` `REQ-08-015` |
| `src/features/hasm/api.js:158` function **deleteEntity** | `REQ-04-RULE-028` `REQ-04-RULE-029` |
| `src/features/hasm/api.js:69` function **getEntityDetail** | `REQ-04-RULE-010` |
| `src/features/hasm/api.js:170` function **launchExternalMarkdownApp** | `REQ-05-FUNC-101` `REQ-05-RULE-002` |
| `src/features/hasm/api.js:164` function **loadEntityDetail** | `REQ-04-FUNC-103` `REQ-04-FUNC-114` `REQ-04-RULE-027` |
| `src/features/hasm/api.js:117` function **loadHasmModelDb** | `REQ-02-RULE-008` `REQ-02-FUNC-407` |
| `src/features/hasm/api.js:63` function **openHasmModel** | `REQ-04-RULE-010` |
| `src/features/hasm/api.js:35` function **pickWorkspaceDirectory** | `REQ-08-001` |
| `src/features/hasm/api.js:105` function **releaseWorkspaceLock** | `REQ-02-RULE-003` `REQ-02-FUNC-109` |
| `src/features/hasm/api.js:168` function **reloadEntityMarkdown** | `REQ-04-FUNC-507` `REQ-06-FUNC-304` |
| `src/features/hasm/api.js:82` function **saveEntityDetail** | `REQ-04-RULE-010` `REQ-04-RULE-016` `REQ-04-RULE-003` |
| `src/features/hasm/api.js:95` function **subscribeToTauriEvent** | `REQ-02-FUNC-108` `REQ-02-FUNC-201` `REQ-03-FUNC-101` |
| `src/features/hasm/api.js:111` function **switchWorkspaceCleanly** | `REQ-07-RULE-003` `REQ-07-FUNC-203` |
| `src/features/hasm/api.js:19` function **validateAppVersion** | `REQ-01-FUNC-301` |
| `src/features/hasm/api.js:25` function **validateHasmFolderPath** | `REQ-01-FUNC-401` `REQ-01-FUNC-503` |
| `src/features/hasm/api.js:14` function **validateHasmMarkdownApp** | `REQ-01-FUNC-201` |
| `src/features/hasm/api.js:122` function **verifyHasmStorage** | `REQ-02-FUNC-301` |
| `src/features/hasm/api.js:53` function **withTimeout** | `REQ-01-RULE-005` |
| `src/features/navigation/GlobalNavbar.jsx:14` default export **GlobalNavbar** | `REQ-07-RULE-004` `REQ-07-FUNC-201` `REQ-07-FUNC-401` `REQ-07-RULE-003` `REQ-07-FUNC-203` `REQ-07-FUNC-204` `REQ-07-RULE-005` `REQ-07-FUNC-301` |
| `src/features/navigation/ProtectedRoute.jsx:20` default export **ProtectedRoute** | `REQ-07-RULE-001` `REQ-07-RULE-002` `REQ-07-FUNC-101` `REQ-07-FUNC-102` `REQ-07-FUNC-103` `REQ-07-FUNC-104` |
| `src/features/theme/ThemeContext.jsx:11` function **ThemeProvider** | `REQ-07-RULE-005` `REQ-07-FUNC-301` |
| `src/features/theme/ThemeContext.jsx:16` function **useTheme** | `REQ-07-FUNC-301` `REQ-07-FUNC-302` |
| `src/pages/AppBootGatePage.jsx:36` default export **AppBootGatePage** | `REQ-01-RULE-001` `REQ-01-RULE-002` `REQ-01-RULE-003` `REQ-01-FUNC-002` `REQ-01-FUNC-201` `REQ-01-FUNC-203` `REQ-01-FUNC-205` `REQ-01-FUNC-206` `REQ-01-FUNC-301` `REQ-01-FUNC-308` `REQ-01-FUNC-309` `REQ-01-FUNC-310` `REQ-01-FUNC-401` `REQ-01-FUNC-403` `REQ-01-FUNC-404` `REQ-01-FUNC-405` `REQ-01-FUNC-406` `REQ-01-FUNC-502` `REQ-01-FUNC-601` `REQ-01-FUNC-602` |
| `src/pages/EntityCreatePage.jsx:26` default export **EntityCreatePage** | `REQ-04-RULE-010` `REQ-04-RULE-011` |
| `src/pages/EntityDetailPage.jsx:49` default export **EntityDetailPage** | `REQ-04-FUNC-101` `REQ-04-FUNC-102` `REQ-04-FUNC-115` `REQ-04-FUNC-501` `REQ-04-RULE-013` `REQ-04-RULE-015` |
| `src/pages/ErrorAppPage.jsx:8` default export **ErrorAppPage** | `REQ-06-RULE-001` `REQ-06-FUNC-101` `REQ-06-FUNC-102` |
| `src/pages/ErrorModelPage.jsx:8` default export **ErrorModelPage** | `REQ-06-RULE-001` `REQ-06-FUNC-201` `REQ-06-FUNC-206` |
| `src/pages/LoadingModelPage.jsx:45` default export **LoadingModelPage** | `REQ-02-FUNC-101` `REQ-02-FUNC-102` `REQ-02-FUNC-104` `REQ-02-FUNC-106` `REQ-02-FUNC-201` `REQ-02-FUNC-203` `REQ-02-FUNC-204` `REQ-02-FUNC-205` `REQ-02-FUNC-302` `REQ-02-FUNC-306` `REQ-02-FUNC-407` `REQ-02-RULE-014` `REQ-02-RULE-011` `REQ-02-RULE-013` `REQ-07-FUNC-105` |
| `src/pages/ModelInitializationPage.jsx:17` default export **ModelInitializationPage** | `REQ-08-015` `REQ-02-FUNC-306` |
| `src/pages/SelectModelPage.jsx:31` default export **SelectModelPage** | `REQ-01-FUNC-503` `REQ-01-FUNC-504` `REQ-01-FUNC-505` `REQ-01-FUNC-506` `REQ-01-FUNC-508` `REQ-01-FUNC-509` `REQ-01-FUNC-510` `REQ-01-FUNC-512` `REQ-01-FUNC-601` `REQ-01-FUNC-602` `REQ-02-RULE-012` `REQ-07-RULE-002` `REQ-08-001` `REQ-08-002` |
| `src/pages/VisualizerPage.jsx:30` default export **VisualizerPage** | `REQ-03-RULE-014` `REQ-03-FUNC-101` `REQ-03-FUNC-102` `REQ-03-FUNC-103` `REQ-03-FUNC-104` `REQ-03-FUNC-106` `REQ-03-FUNC-107` `REQ-03-RULE-018` `REQ-03-FUNC-201` `REQ-03-FUNC-202` `REQ-03-FUNC-203` `REQ-03-FUNC-302` `REQ-08-014` |
