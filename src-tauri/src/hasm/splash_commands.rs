//! SEQ-01 splash screen handoff.
//!
//! [SEQ-MD-01][SPLASH] The `splashscreen` window is visible from process start while
//! the hidden `main` window runs boot validation. The main window is shown once,
//! after the frontend reports boot completion AND the minimum display time has
//! elapsed. A fallback timer guarantees the handoff even if the frontend never
//! reports completion, so a failed boot cannot leave the user on the splash.

use log::{info, warn};
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, Runtime, State};

pub const SPLASH_WINDOW_LABEL: &str = "splashscreen";
pub const MAIN_WINDOW_LABEL: &str = "main";
pub const MIN_SPLASH_DURATION: Duration = Duration::from_secs(5);
pub const SPLASH_FALLBACK_TIMEOUT: Duration = Duration::from_secs(30);
/// Emitted once with the handoff reason (boot outcome or `fallback`) after `main` is shown.
pub const SPLASH_HANDOFF_EVENT: &str = "hasm://splash-handoff";

pub struct SplashState {
    started_at: Instant,
    handed_off: AtomicBool,
}

impl SplashState {
    pub fn new(started_at: Instant) -> Self {
        Self {
            started_at,
            handed_off: AtomicBool::new(false),
        }
    }

    /// Returns true only for the first caller so the handoff runs exactly once
    /// (React StrictMode, repeated boots, and the fallback timer may all race).
    fn claim_handoff(&self) -> bool {
        self.handed_off
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .is_ok()
    }

    fn remaining_at(&self, now: Instant) -> Duration {
        remaining_splash_delay(now.saturating_duration_since(self.started_at))
    }
}

pub fn remaining_splash_delay(elapsed: Duration) -> Duration {
    MIN_SPLASH_DURATION.saturating_sub(elapsed)
}

/// Called from Tauri `setup` right after the windows are created.
pub fn start_splash_fallback<R: Runtime>(app: &AppHandle<R>) {
    let handle = app.clone();
    let spawn_result = thread::Builder::new()
        .name("hasm-splash-fallback".into())
        .spawn(move || {
            thread::sleep(SPLASH_FALLBACK_TIMEOUT);
            if handle.state::<SplashState>().claim_handoff() {
                warn!(
                    "[SEQ-MD-01][SPLASH] boot completion not reported within {}s; showing main window",
                    SPLASH_FALLBACK_TIMEOUT.as_secs()
                );
                show_main_window(&handle, "fallback");
            }
        });
    if let Err(error) = spawn_result {
        warn!("[SEQ-MD-01][SPLASH] fallback timer unavailable; showing main window: {error}");
        if app.state::<SplashState>().claim_handoff() {
            show_main_window(app, "fallback");
        }
    }
}

/// [SEQ-MD-01][SPLASH] Frontend boot gate reports a terminal outcome
/// (`select`, `loading-model`, `error-app`, ...). Returns the delay applied in ms.
#[tauri::command]
pub fn complete_app_launch<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, SplashState>,
    outcome: String,
) -> u64 {
    if !state.claim_handoff() {
        info!("[SEQ-MD-01][SPLASH] launch completion already handled; outcome={outcome}");
        return 0;
    }

    let delay = state.remaining_at(Instant::now());
    info!(
        "[SEQ-MD-01][SPLASH] boot completed; outcome={outcome}; remaining_splash_ms={}",
        delay.as_millis()
    );

    if delay.is_zero() {
        show_main_window(&app, &outcome);
    } else {
        let handle = app.clone();
        let reason = outcome.clone();
        let spawn_result = thread::Builder::new()
            .name("hasm-splash-handoff".into())
            .spawn(move || {
                thread::sleep(delay);
                show_main_window(&handle, &reason);
            });
        if let Err(error) = spawn_result {
            warn!("[SEQ-MD-01][SPLASH] handoff timer unavailable; showing main window now: {error}");
            show_main_window(&app, &outcome);
        }
    }
    delay.as_millis() as u64
}

/// Shows and focuses `main` before closing `splashscreen` so a window is always visible.
pub fn show_main_window<R: Runtime>(app: &AppHandle<R>, reason: &str) {
    match app.get_webview_window(MAIN_WINDOW_LABEL) {
        Some(main) => {
            if let Err(error) = main.show() {
                warn!("[SEQ-MD-01][SPLASH] failed to show main window: {error}");
            }
            if let Err(error) = main.set_focus() {
                warn!("[SEQ-MD-01][SPLASH] failed to focus main window: {error}");
            }
        }
        None => warn!("[SEQ-MD-01][SPLASH] main window not found"),
    }

    match app.get_webview_window(SPLASH_WINDOW_LABEL) {
        Some(splash) => match splash.close() {
            Ok(()) => info!("[SEQ-MD-01][SPLASH] splash closed; main window shown"),
            Err(error) => warn!("[SEQ-MD-01][SPLASH] failed to close splash window: {error}"),
        },
        None => info!("[SEQ-MD-01][SPLASH] splash window already closed"),
    }

    if let Err(error) = app.emit(SPLASH_HANDOFF_EVENT, reason) {
        warn!("[SEQ-MD-01][SPLASH] failed to emit handoff event: {error}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splash_commands_keep_minimum_display_time() {
        assert_eq!(remaining_splash_delay(Duration::ZERO), MIN_SPLASH_DURATION);
        assert_eq!(
            remaining_splash_delay(Duration::from_millis(1200)),
            Duration::from_millis(3800)
        );
        assert_eq!(remaining_splash_delay(MIN_SPLASH_DURATION), Duration::ZERO);
        assert_eq!(remaining_splash_delay(Duration::from_secs(12)), Duration::ZERO);
        assert!(MIN_SPLASH_DURATION >= Duration::from_secs(5));
        assert!(SPLASH_FALLBACK_TIMEOUT > MIN_SPLASH_DURATION);
    }

    #[test]
    fn splash_commands_measure_from_launch_and_hand_off_once() {
        let started_at = Instant::now();
        let state = SplashState::new(started_at);
        assert_eq!(
            state.remaining_at(started_at + Duration::from_secs(2)),
            Duration::from_secs(3)
        );
        assert_eq!(
            state.remaining_at(started_at + Duration::from_secs(6)),
            Duration::ZERO
        );
        assert!(state.claim_handoff());
        assert!(!state.claim_handoff());
    }
}
