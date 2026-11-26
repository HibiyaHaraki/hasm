fn main() {
    tauri_build::build();
    if std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc") {
        // Tauri mock-runtime tests also link TaskDialogIndirect, which requires v6 controls.
        if std::env::var_os("CARGO_FEATURE_WINDOWS_TEST_MANIFEST").is_some() {
            // The library unit-test harness needs linker args that Cargo's test-only
            // directive does not apply to this target.
            println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
            println!("cargo:rustc-link-arg=/MANIFESTDEPENDENCY:type='win32' name='Microsoft.Windows.Common-Controls' version='6.0.0.0' processorArchitecture='*' publicKeyToken='6595b64144ccf1df' language='*'");
        } else {
            println!("cargo:rustc-link-arg-tests=/MANIFEST:EMBED");
            println!("cargo:rustc-link-arg-tests=/MANIFESTDEPENDENCY:type='win32' name='Microsoft.Windows.Common-Controls' version='6.0.0.0' processorArchitecture='*' publicKeyToken='6595b64144ccf1df' language='*'");
        }
    }
}
