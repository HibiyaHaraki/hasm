use hasm_lib::hasm::app_commands;
use serde_json::Value;
use tauri::Manager;

#[test]
fn markdown_app_validation_checks_the_packaged_executable_through_invoke() {
    let app = tauri::test::mock_builder()
        .invoke_handler(tauri::generate_handler![
            app_commands::validate_hasm_markdown_app
        ])
        .build(tauri::test::mock_context(tauri::test::noop_assets()))
        .unwrap();
    let resource_dir = app.path().resource_dir().unwrap();
    let packaged_executable = resource_dir.join("binaries").join("hasm_markdown.exe");
    let development_executable = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("binaries")
        .join("hasm_markdown.exe");
    let window = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();

    let response = tauri::test::get_ipc_response(
        &window,
        tauri::webview::InvokeRequest {
            cmd: "validate_hasm_markdown_app".into(),
            callback: tauri::ipc::CallbackFn(0),
            error: tauri::ipc::CallbackFn(1),
            url: "http://tauri.localhost".parse().unwrap(),
            body: tauri::ipc::InvokeBody::Json(Value::Null),
            headers: Default::default(),
            invoke_key: tauri::test::INVOKE_KEY.into(),
        },
    );

    assert!(
        packaged_executable.is_file() || development_executable.is_file(),
        "test requires a packaged or development-staged HASM Markdown executable"
    );
    assert!(
        response.is_ok(),
        "HASM Markdown validation failed through Tauri IPC: {response:?}"
    );
}
