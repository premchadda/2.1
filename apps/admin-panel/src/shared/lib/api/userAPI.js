import { ValidationError } from "@trstprep/shared-config";
import { apiClient } from "../apiClient.js";

const ALLOWED_PROFILE_FIELDS = new Set([
  "name",
  "avatar",
  "bio",
  "phone",
  "mobile",
  "preferences",
  "notificationPreferences",
  "language",
]);
export const userAPI = {
  getProfile: () => apiClient.get("/users/profile"),
  updateProfile: (data) => {
    if (!data || Object.keys(data).length === 0) {
      throw new ValidationError("Profile data is required");
    }
    // allowlist to prevent mass-assignment of role/isAdmin
    const clean = {};
    for (const k of Object.keys(data)) {
      if (ALLOWED_PROFILE_FIELDS.has(k)) clean[k] = data[k];
    }
    if (Object.keys(clean).length === 0)
      throw new ValidationError("No valid profile fields provided");
    if (clean.name && String(clean.name).trim().length < 2)
      throw new ValidationError("Name too short");
    return apiClient.put("/users/profile", clean);
  },
  enrollSeries: (seriesId) => {
    if (
      seriesId === undefined ||
      seriesId === null ||
      String(seriesId).trim() === ""
    )
      throw new ValidationError("Test Series ID is required");
    return apiClient.post(
      `/users/enroll/${encodeURIComponent(String(seriesId))}`,
    );
  },
  unenrollFromSeries: (seriesId) => {
    if (
      seriesId === undefined ||
      seriesId === null ||
      String(seriesId).trim() === ""
    )
      throw new ValidationError("Test Series ID is required");
    return apiClient.delete(
      `/users/unenroll/${encodeURIComponent(String(seriesId))}`,
    );
  },
  getEnrolledSeries: () => apiClient.get("/users/enrolled-series"),
  getAttempts: () => apiClient.get("/users/attempts"),
  getAnalytics: () => apiClient.get("/users/analytics"),
  deleteAccount: () => apiClient.delete("/users/profile"),
};

export default userAPI;
