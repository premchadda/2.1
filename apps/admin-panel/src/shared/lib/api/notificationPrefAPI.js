// Notification preference endpoints.
// Backend: apps/backend/src/api/routes/notificationsPref.js (mounted at /api/notifications-pref)
import { ValidationError } from "@trstprep/shared-config";
import { apiClient } from "../apiClient.js";

export const notificationPrefAPI = {
  subscribe: (data) => {
    if (!data || typeof data !== "object")
      throw new ValidationError("Subscription data required");
    const { endpoint, keys, subscription } = data;
    if (!endpoint && !subscription?.endpoint)
      throw new ValidationError("Push endpoint required");
    return apiClient.post("/notifications-pref/subscribe", data);
  },
  unsubscribe: (data) =>
    apiClient.post("/notifications-pref/unsubscribe", data),
  getPreferences: () => apiClient.get("/notifications-pref/preferences"),
  updatePreferences: (data) =>
    apiClient.put("/notifications-pref/preferences", data),
};

export default notificationPrefAPI;
