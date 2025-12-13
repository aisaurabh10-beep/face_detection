module.exports = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",
  MONGODB_URI:
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/attendance_poc",
  STUDENT_LIMIT: process.env.STUDENT_LIMIT || 50,
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3015",
  SOCKET_CORS_ORIGIN: process.env.SOCKET_CORS_ORIGIN || "http://localhost:3015",
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS?.split(", ") || [
    "http://localhost:3015",
    "http://localhost:3001",
    "http://127.0.0.1:8000",
  ],

  // File Upload Configuration
  MAX_FILE_SIZE: 15 * 1024 * 1024, // 15MB
  MAX_STUDENT_PHOTOS: 6,
  ALLOWED_FILE_TYPES: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
  UPLOAD_BASE_DIR: "uploads",
  UPLOAD_STUDENTS_DIR: "students",
  UPLOAD_UNKNOWN_DIR: "unknown",

  // API Configuration
  EMBEDDING_SYNC_API_URL:
    process.env.EMBEDDING_SYNC_API_URL ||
    "http://127.0.0.1:8000/sync-embeddings",
  EMBEDDING_SYNC_TIMEOUT: 60000, // 60 seconds
  SYNC_SUCCESS_STATUS: "True",

  // Pagination Defaults
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,

  // Validation Constants
  MIN_NAME_LENGTH: 2,
  MIN_PHONE_LENGTH: 10,
  MIN_CONFIDENCE: 0,
  MAX_CONFIDENCE: 1,

  // Response Messages
  MESSAGES: {
    SUCCESS: {
      STUDENT_REGISTERED: "Student registered successfully",
      STUDENT_UPDATED: "Student updated successfully",
      STUDENT_DELETED: "Student deleted successfully",
      STUDENT_STATUS_TOGGLED: "Student status updated successfully",
      ATTENDANCE_MARKED: "Attendance marked successfully",
      UNKNOWN_FACE_LOGGED: "Unknown face logged successfully",
      UNKNOWN_FACE_UPDATED: "Unknown face updated successfully",
      UNKNOWN_FACE_DELETED: "Unknown face deleted successfully",
      UNKNOWN_FACE_PROCESSED: "Unknown face marked as processed",
      NOTIFICATIONS_MARKED_READ: "Notifications marked as read",
      EMBEDDING_SYNCED: "Student registered and embeddings synced successfully",
    },
    ERROR: {
      INTERNAL_SERVER: "An internal server error occurred",
      NOT_FOUND: "Resource not found",
      VALIDATION_FAILED: "Validation failed",
      STUDENT_NOT_FOUND: "Student not found",
      STUDENT_EXISTS: "Student with this email or roll number already exists",
      ATTENDANCE_ERROR: "Error processing attendance",
      UNKNOWN_FACE_NOT_FOUND: "Unknown face record not found",
      FILE_UPLOAD_ERROR: "File upload failed",
      INVALID_FILE_TYPE: "Only image files are allowed",
      FILE_SIZE_EXCEEDED: "File size exceeds the maximum allowed limit",
      PHOTOS_REQUIRED: "At least one photo is required",
      INVALID_IDS: "Invalid IDs provided",
      EMBEDDING_SYNC_FAILED: "Student saved but embedd",
      EMBEDDING_API_ERROR: "Student saved but failed to call sync API",
      STUDENT_LIMIT_REACHED: "Student registration limit reached",
    },
  },

  // Status Codes
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500,
  },
};
