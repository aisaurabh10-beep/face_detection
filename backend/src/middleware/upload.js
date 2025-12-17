const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const config = require("../config/config");

const studentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const studentId = (req.body?.studentId || "unknown").toString();
    const baseDir = path.join(
      config.UPLOAD_BASE_DIR,
      config.UPLOAD_STUDENTS_DIR,
      studentId
    );
    try {
      fs.mkdirSync(baseDir, { recursive: true });
    } catch (error) {}
    cb(null, baseDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `student_${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const unknownStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const baseDir = path.join(
      config.UPLOAD_BASE_DIR,
      config.UPLOAD_UNKNOWN_DIR
    );
    try {
      fs.mkdirSync(baseDir, { recursive: true });
    } catch (error) {}
    cb(null, baseDir);
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
  if (config.ALLOWED_FILE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(config.MESSAGES.ERROR.INVALID_FILE_TYPE), false);
  }
};

// Multer configurations
const studentUpload = multer({
  storage: studentStorage,
  // fileFilter: imageFilter,
  // limits: {
  //   fileSize: config.MAX_FILE_SIZE,
  // },
});

const unknownUpload = multer({
  storage: unknownStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: config.MAX_FILE_SIZE,
  },
});

module.exports = {
  studentUpload,
  unknownUpload,
};
