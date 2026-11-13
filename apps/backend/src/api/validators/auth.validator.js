import { createSchema } from "../../middleware/validation/inputValidation.js";

/**
 * Normalizes mobile/phone input by stripping spaces, hyphens, and +91/91 country code
 */
export const normalizeMobile = (val) => {
  if (typeof val !== "string") return val;
  let cleaned = val.replace(/[\s-]/g, "");
  if (cleaned.startsWith("+91")) {
    cleaned = cleaned.slice(3);
  } else if (cleaned.startsWith("91") && cleaned.length === 12) {
    cleaned = cleaned.slice(2);
  }
  return cleaned.trim();
};

// Auth validation schemas — was a placeholder (empty schema) that let any input
// through. Now defines actual validation rules for login, register, password reset.

// POST /api/auth/login
export const loginSchema = createSchema()
  .field("email", {
    type: "email",
    required: true,
    message: "A valid email address is required",
  })
  .field("password", {
    type: "string",
    required: true,
    minLength: 1,
    maxLength: 128,
    sanitize: false,
  });

// POST /api/auth/register
export const registerSchema = createSchema()
  .field("email", {
    type: "email",
    required: true,
    message: "A valid email address is required",
  })
  .field("password", {
    type: "string",
    required: true,
    minLength: 8,
    maxLength: 128,
    sanitize: false,
  })
  .field("name", {
    type: "string",
    required: true,
    minLength: 1,
    maxLength: 100,
  })
  .field("mobile", {
    type: "string",
    required: false,
    pattern: /^[6-9]\d{9}$/,
    message:
      "Mobile number must be a valid 10-digit Indian number starting with 6-9",
  });

// Normalize mobile/phone input before running schema validation
const origRegisterValidate = registerSchema.validate.bind(registerSchema);
registerSchema.validate = function (data) {
  if (data && typeof data === "object") {
    if (data.mobile === undefined && data.phone !== undefined) {
      data.mobile = data.phone;
    }
    if (typeof data.mobile === "string") {
      data.mobile = normalizeMobile(data.mobile);
    }
  }
  return origRegisterValidate(data);
};

// POST /api/auth/forgot-password
export const forgotPasswordSchema = createSchema().field("email", {
  type: "email",
  required: true,
  message: "A valid email address is required",
});

// POST /api/auth/reset-password
export const resetPasswordSchema = createSchema()
  .field("token", { type: "string", required: true, sanitize: false })
  .field("newPassword", {
    type: "string",
    required: true,
    minLength: 8,
    maxLength: 128,
    sanitize: false,
  });

// POST /api/auth/change-password
export const changePasswordSchema = createSchema()
  .field("currentPassword", { type: "string", required: true, sanitize: false })
  .field("newPassword", {
    type: "string",
    required: true,
    minLength: 8,
    maxLength: 128,
    sanitize: false,
  });

// Default export (backward compat — was empty schema)
export default createSchema();
