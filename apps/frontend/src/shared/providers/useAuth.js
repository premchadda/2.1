import { useContext } from "react";
import { AuthContext, createFallbackAuthContext } from "./AuthContextCore.js";

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === null || context === undefined) {
    // DIVERGENCE FROM ADMIN PANEL (intentional — keep the fallback): the
    // student app renders many public/anonymous routes outside AuthProvider
    // (landing, blogs, shared links). Throwing here — as apps/admin-panel's
    // useAuth does — would crash those pages, so we return a no-auth context
    // instead. Do NOT change this to throw. The DEV-only warn below flags
    // genuine mis-wiring without spamming production consoles.
    if (import.meta.env.DEV) {
      console.warn(
        "useAuth called outside AuthProvider. Falling back to no-auth context.",
      );
    }
    return createFallbackAuthContext();
  }
  return context;
}
