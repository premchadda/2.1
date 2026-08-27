import { getAssetUrl } from "@trstprep/shared-config";

// Map backend user data to frontend format
export function mapUserToFrontend(userData) {
  if (!userData) return null;

  return {
    id: userData._id || userData.id,
    name: userData.name,
    email: userData.email,
    mobile: userData.mobile,
    role: userData.role || "user",
    isProUser: userData.isProUser || false,
    proPassExpiry: userData.proPassExpiry,
    proPassType: userData.proPassType,
    avatar: getAssetUrl(userData.avatar),
    hasProPass: userData.isProUser || false,
    ...userData,
  };
}
