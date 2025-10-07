module.exports = {
  MONGODB_URI:
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/attendance_poc",
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3015",
  MAX_FILE_SIZE: 5242880, // 5MB
  ALLOWED_FILE_TYPES: "image/jpeg,image/png,image/jpg",
  SOCKET_CORS_ORIGIN: process.env.SOCKET_CORS_ORIGIN || "http://localhost:3015",
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS?.split(", ") || ["http://localhost:3015", "http://localhost:3001"],
};
