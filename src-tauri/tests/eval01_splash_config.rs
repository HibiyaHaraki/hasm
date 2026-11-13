//! EVAL-01 splash window launch configuration contract (REQ-01-FUNC-001).
//!
//! Verifies `tauri.conf.json`, the configuration Tauri uses to create the windows at
//! launch: the `splashscreen` window must load the `hasm_logo` HASM splash bundle
//! while the `main` window starts hidden, and the `hasm_markdown` splash variant
//! must never be referenced.

use serde_json::Value;
use std::path::Path;

fn load_windows() -> Vec<Value> {
    let config_path = Path::new(env!("CARGO_MANIFEST_DIR")).join("tauri.conf.json");
    let config: Value =
        serde_json::from_str(&std::fs::read_to_string(config_path).unwrap()).unwrap();
    config["app"]["windows"].as_array().unwrap().clone()
}

// TC-01-RUST-022 [REQ-01-FUNC-001] Positive: launch opens the `splashscreen` window on
// the generated HASM splash bundle (`splash/sprash_animation.html`) while the `main`
// window is created hidden.
#[test]
fn eval01_splash_window_configuration_matches_launch_contract() {
    let windows = load_windows();

    let main = windows
        .iter()
        .find(|w| w["label"] == "main")
        .expect("main window must be configured");
    assert_eq!(main["visible"], Value::Bool(false), "main window must start hidden");

    let splash = windows
        .iter()
        .find(|w| w["label"] == "splashscreen")
        .expect("splashscreen window must be configured");
    let url = splash["url"].as_str().unwrap();
    assert!(
        url.starts_with("splash/sprash_animation.html"),
        "splashscreen must load the hasm_logo HASM splash bundle, got {url}"
    );
}

// TC-01-RUST-023 [REQ-01-FUNC-001] Negative (reject): no launch window may reference
// the `hasm_markdown` splash variant, and no extra pre-boot window may be visible
// besides the splash screen.
#[test]
fn eval01_splash_configuration_rejects_markdown_variant() {
    let windows = load_windows();

    for window in &windows {
        let url = window["url"].as_str().unwrap_or("");
        assert!(
            !url.contains("hasm_markdown") && !url.contains("markdown"),
            "window {:?} must not use the hasm_markdown splash variant",
            window["label"]
        );
        // Only the splash screen may be visible before the boot handoff.
        if window["label"] != "splashscreen" {
            assert_eq!(
                window["visible"],
                Value::Bool(false),
                "window {:?} must start hidden",
                window["label"]
            );
        }
    }
}
