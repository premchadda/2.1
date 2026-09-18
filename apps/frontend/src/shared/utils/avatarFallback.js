/**
 * Shared avatar fallback helper (student app).
 *
 * Centralizes the onError pattern used across Settings, NavbarProfile,
 * QuestionPalette, and PracticeWorkspace: hide the broken <img> and reveal
 * the initials sibling. Also provides a ui-avatars URL fallback for cases
 * where an <img> src swap is preferred over initials.
 */

export const getAvatarFallbackUrl = (name = "User") => {
  const label = encodeURIComponent(String(name || "User").trim() || "User");
  return `https://ui-avatars.com/api/?name=${label}&background=4F46E5&color=fff`;
};

export const getAvatarFallback = getAvatarFallbackUrl;

export const handleAvatarError = (e) => {
  const target = e?.currentTarget || e?.target;
  if (!target) return;
  // Guard against repeat firing after src swap / re-render loops.
  if (target.dataset?.avatarErrorHandled === "1") return;
  target.dataset.avatarErrorHandled = "1";
  target.style.display = "none";
  const sibling = target.nextSibling;
  if (sibling && sibling.style) {
    // Default to flex (avatar fallbacks are flex-centered); opt out with
    // data-avatar-fallback-display="inline" where inline is intended.
    const wantsInline = sibling.dataset?.avatarFallbackDisplay === "inline";
    sibling.style.display = wantsInline ? "inline" : "flex";
  }
};

export default {
  getAvatarFallback,
  getAvatarFallbackUrl,
  handleAvatarError,
};
