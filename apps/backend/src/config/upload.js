import rateLimit from "express-rate-limit";
import multer from "multer";

export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 uploads per windowMs
  message: {
    success: false,
    message: "Too many uploads from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Configure multer with file size limits
export const fileUpload = multer({
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Basic file type validation
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "video/mp4",
      "video/webm",
      "video/avi",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only images, PDFs, and videos are allowed.",
        ),
        false,
      );
    }
  },
});
