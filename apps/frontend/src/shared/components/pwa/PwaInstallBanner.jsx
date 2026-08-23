// PwaInstallBanner is intentionally a null stub in Phase 1.
// Install-prompt logic was consolidated into the shared-hooks PWA hook
// (usePwaInstall) to avoid duplicated beforeinstallprompt handlers across
// the student app and admin panel. This component is kept as a stub so
// existing <PwaInstallBanner /> mounts remain no-ops without breaking layouts;
// future phases may re-enable a UI banner here via the shared hook.
export default function PwaInstallBanner() {
  return null;
}
