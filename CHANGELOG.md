# Changelog

## Unreleased
- No unreleased changes.

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
