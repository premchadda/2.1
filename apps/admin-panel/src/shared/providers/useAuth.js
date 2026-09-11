import { useContext } from "react";
import { AuthContext } from "./AuthContextCore.js";

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    // DIVERGENCE FROM FRONTEND (intentional — keep the throw): the admin
    // panel must fail fast when used outside AuthProvider. Silently falling
    // back to a guest/null-user context could expose privileged routes or
    // send unauthenticated admin API calls; the frontend may use a softer
    // fallback instead. Do not change this signature.
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
