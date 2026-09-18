// Canonical source: @trstprep/shared-hooks (deduped — was byte-identical in frontend + admin-panel).
// NOTE: imported via the bare specifier on purpose — vite resolve.alias maps
// the bare "@trstprep/shared-hooks" prefix to the package dir, which bypasses
// the package.json "exports" map for subpath imports. Same pattern as ui/EmptyState.jsx.
export { HorizontalScroll as default } from "@trstprep/shared-hooks";
