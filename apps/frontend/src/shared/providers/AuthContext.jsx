/**
 * AuthContext entry point
 *
 * Re-exports AuthProvider, useAuth, and AuthContext from dedicated modules
 * to ensure 100% Vite Fast Refresh (HMR) compatibility.
 */

import { AuthProvider } from "./AuthProvider";

export { AuthProvider };
export { useAuth } from "./useAuth";
export { AuthContext, createFallbackAuthContext } from "./AuthContextCore";
export {
  applyAuthSession,
  saveAuthTokens,
  clearAuthTokens,
  getInitialUser,
  saveUserCache,
  USER_CACHE_KEY,
} from "./authSession";

export default AuthProvider;
