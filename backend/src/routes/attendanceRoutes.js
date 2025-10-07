const express = require("express");
const router = express.Router();
const {
  markAttendance,
  getTodayAttendance,
  getStudentAttendance,
  getAttendanceStats,
  getDailyClassWise,
} = require("../controllers/attendanceController");
const { validateAttendance } = require("../middleware/validation");

router.post("/mark", validateAttendance, markAttendance);
router.get("/today", getTodayAttendance);
router.get("/student/:studentId", getStudentAttendance);
router.get("/stats", getAttendanceStats);
router.get("/daily-classwise", getDailyClassWise);

module.exports = router;
