# Contributing

Thanks for your interest in improving HASM.

## Development setup

1. Install Node.js 22+ and Rust stable.
2. Install frontend dependencies:
   - `npm ci`
3. Build frontend:
   - `npm run build`
4. Validate backend:
   - `cd src-tauri && cargo check`

## Pull request expectations

1. Keep PRs focused and small when possible.
2. Add or update docs when behavior changes.
3. Ensure CI checks pass.
4. Use clear commit messages and PR descriptions.

## Reporting issues

Use the issue templates for bugs and feature requests so maintainers can triage quickly.
