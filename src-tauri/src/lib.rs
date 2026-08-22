//! # lib.rs
//! Hibiya Haraki (August, 2026)
//! ## Purpose
//! Library script for HASM Tauri app.

mod hasm;
#[allow(unused_imports)]
#[path = "hasm_logger/src/tauri/logger.rs"]
mod logger;

use crate::logger::init_logger;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    init_logger();
    // Step 1. Build Tauri app container.
    tauri::Builder::default()
        // Step 2. Register plugins used by desktop runtime.
        .plugin(tauri_plugin_opener::init())
        // Step 3. Register frontend-invokable command handlers.
        .invoke_handler(tauri::generate_handler![
            hasm::app_commands::validate_hasm_markdown_app,
            hasm::app_commands::validate_app_version,
            hasm::app_commands::validate_hasm_folder_path,
            hasm::model_commands::check_workspace_lock,
            hasm::model_commands::release_workspace_lock,
            hasm::model_commands::load_hasm_model_db,
            hasm::model_commands::verify_hasm_storage,
            hasm::visualizer_commands::compute_visualizer_layout,
            hasm::visualizer_commands::create_visualizer_demo_workspace,
            hasm::entity_editor_commands::load_entity_detail,
            hasm::entity_editor_commands::check_entity_mtime,
            hasm::entity_editor_commands::reload_entity_markdown,
            hasm::external_editor_commands::launch_external_markdown_app,
            hasm::commands::open_hasm_model,
            hasm::commands::read_model_database,
            hasm::commands::get_person_detail,
            hasm::commands::get_experience_detail,
            hasm::commands::get_fact_detail,
            hasm::commands::get_link_detail,
            hasm::commands::save_model_database,
            hasm::commands::save_person_detail,
            hasm::commands::save_experience_detail,
            hasm::commands::save_fact_detail,
            hasm::commands::save_link_detail
        ])
        // Step 4. Launch application context.
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
