//! # main.rs
//! Hibiya Haraki (August, 2026)
//! ## Purpose
//! Main entry point for HASM Tauri app.

// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    hasm_lib::run()
}
