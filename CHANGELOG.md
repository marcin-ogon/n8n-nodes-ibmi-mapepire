# Changelog

## Unreleased
- No unreleased changes.

## 0.2.3 - 2025-09-05
### Changed

- Release workflow now generates GitHub Release notes directly from matching section in `CHANGELOG.md`.
- Release script updated to keep `Unreleased` section at the top consistently.

### Added

- Pull request template to guide contributors (ensures changelog fragment + checklist).

## 0.2.2 - 2025-09-05

### Changed

- Refactored internal code structure for improved readability and maintainability (no user-facing behavior changes).
- Added Prettier configuration and automatic formatting integration in release workflow to enforce consistent code style.

## 0.2.1 - 2025-09-04

- Internal changes only.

## 0.2.0 - 2025-09-04

### Added

- Prepared / parameterized SQL execution (`Use Parameters` + `Parameters (JSON)`).
- `Reuse Connection` option to maintain a single SQLJob across all items in an execution.
- `Include Metadata` toggle.
- Enhanced error handling: structured error object (message, name, code, sqlState, stack) when `continueOnFail` is enabled.

### Changed

- README updated with new feature documentation.

### Notes

- Parameter binding relies on underlying `@ibm/mapepire-js` support. Ensure version supports provided `parameters` option.
