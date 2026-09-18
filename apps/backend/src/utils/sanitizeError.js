// Patterns that indicate a message carries DB/driver internals or secrets and
// must never reach the client, even on 4xx. Checked before any raw passthrough.
const INTERNAL_MESSAGE_PATTERN =
  /select\s+["'\w*]|insert\s+into|update\s+["'\w]+\s+set|delete\s+from|relation\s+"?[\w.]+"?|column\s+"?[\w.]+"?\s+does not exist|violates\s+\w+|duplicate\s+key|constraint\s+"|pg_|sequelize|ECONN|ENOENT|ETIMEDOUT|ENOTFOUND|\s+at\s+[\w./\\-]+\.(js|ts):\d+|password|secret|Bearer\s+[A-Za-z0-9]|BEGIN\s+PRIVATE\s+KEY|sk-(live|or-v1)-|rzp_(live|test)_/i;

const STATUS_FALLBACKS = {
  400: "Invalid request",
  401: "Authentication required",
  403: "Access denied",
  404: "Resource not found",
  409: "Resource conflict",
  422: "Invalid input data",
  429: "Too many requests, please try again later",
};

function sanitizeErrorMessage(error) {
  if (process.env.NODE_ENV === "production") {
    // createSafeError userMessage is always client-safe — prefer it.
    if (typeof error.userMessage === "string" && error.userMessage) {
      return error.userMessage;
    }
    const knownErrors = {
      ValidationError: "Invalid input data",
      UnauthorizedError: "Authentication required",
      ForbiddenError: "Access denied",
      NotFoundError: "Resource not found",
      ConflictError: "Resource conflict",
      RateLimitError: "Too many requests, please try again later",
    };
    const errorName = error.constructor?.name || error.name;
    if (knownErrors[errorName]) return knownErrors[errorName];
    const statusCode = error.statusCode || error.status;
    if (statusCode && statusCode < 500) {
      const msg = typeof error.message === "string" ? error.message : "";
      // Raw passthrough only for short messages with no internal/secret markers.
      if (msg && msg.length <= 500 && !INTERNAL_MESSAGE_PATTERN.test(msg)) {
        return msg;
      }
      return (
        STATUS_FALLBACKS[statusCode] || "Invalid request. Please try again."
      );
    }
    return "An unexpected error occurred. Please try again later.";
  }
  return error.message;
}

function createSafeError(statusCode, userMessage, internalMessage) {
  const err = new Error(userMessage);
  err.statusCode = statusCode;
  err.userMessage = userMessage;
  // Store internal message separately — do NOT put it in Error.message
  // because most Express handlers serialize .message to the client
  if (internalMessage) err.internalMessage = internalMessage;
  return err;
}

export { sanitizeErrorMessage, createSafeError };
