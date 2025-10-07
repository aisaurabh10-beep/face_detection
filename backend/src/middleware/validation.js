// Validation middleware for request data

const validateStudent = (req, res, next) => {
  const {
    firstName,
    lastName,
    email,
    phone,
    class: studentClass,
    division,
    rollNumber,
  } = req.body;
  const errors = [];

  if (!firstName || firstName.trim().length < 2) {
    errors.push("First name is required and must be at least 2 characters");
  }

  if (!lastName || lastName.trim().length < 2) {
    errors.push("Last name is required and must be at least 2 characters");
  }

  if (!email || !isValidEmail(email)) {
    errors.push("Valid email is required");
  }

  if (!phone || phone.trim().length < 10) {
    errors.push("Valid phone number is required");
  }

  if (!studentClass || studentClass.trim().length < 1) {
    errors.push("Class is required");
  }

  if (!division || division.trim().length < 1) {
    errors.push("Division is required");
  }

  if (!rollNumber || rollNumber.trim().length < 1) {
    errors.push("Roll number is required");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: true,
      message: "Validation failed",
      details: errors,
    });
  }

  next();
};

const validateAttendance = (req, res, next) => {
  const { studentId, cameraId, confidence } = req.body;

  const errors = [];

  if (!studentId) {
    errors.push("Student ID is required");
  }

  if (!cameraId) {
    errors.push("Camera ID is required");
  }

  if (confidence !== undefined && (confidence < 0 || confidence > 1)) {
    errors.push("Confidence must be between 0 and 1");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: true,
      message: "Validation failed",
      details: errors,
    });
  }

  next();
};

const validateUnknownFace = (req, res, next) => {
  const { cameraId, confidence } = req.body;

  const errors = [];

  if (!cameraId) {
    errors.push("Camera ID is required");
  }

  if (confidence !== undefined && (confidence < 0 || confidence > 1)) {
    errors.push("Confidence must be between 0 and 1");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: true,
      message: "Validation failed",
      details: errors,
    });
  }

  next();
};

// Helper function to validate email
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

module.exports = {
  validateStudent,
  validateAttendance,
  validateUnknownFace,
};
