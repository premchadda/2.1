import { toast } from "react-hot-toast";

/**
 * Copy text to system clipboard with fallback and toast notification.
 * @param {string} text - Text to copy
 * @param {string} [label] - Optional noun phrase for user notification (e.g., "Email", "Token")
 * @returns {Promise<boolean>} True if copy succeeded
 */
export const copyToClipboard = async (text, label) => {
  if (!text && text !== 0) return false;
  const str = String(text);

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(str);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = str;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    const message = label
      ? `${label} copied to clipboard!`
      : "Copied to clipboard!";
    toast.success(message);
    return true;
  } catch (err) {
    console.error("Failed to copy to clipboard:", err);
    toast.error("Failed to copy to clipboard");
    return false;
  }
};

export default copyToClipboard;
