const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

// Configure storage for student photos - per student folder
const studentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const studentId = (req.body?.studentId || "unknown").toString();
    const baseDir = path.join("uploads", "students", studentId);
    try {
      fs.mkdirSync(baseDir, { recursive: true });
    } catch (e) {
      // ignore
    }
    cb(null, baseDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `student_${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// Configure storage for unknown face photos
const unknownStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/unknown/");
  },
  filename: (req, file, cb) => {
    const uniqueName = `unknown_${Date.now()}_${uuidv4()}${path.extname(
      file.originalname
    )}`;
    cb(null, uniqueName);
  },
});

// File filter for images only
const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

// Multer configurations
const studentUpload = multer({
  storage: studentStorage,
  // fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

const unknownUpload = multer({
  storage: unknownStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

module.exports = {
  studentUpload,
  unknownUpload,
};
