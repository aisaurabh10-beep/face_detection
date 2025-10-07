const express = require("express");
const router = express.Router();
const {
  getAllStudents,
  getStudentById,
  registerStudent,
  updateStudent,
  deleteStudent,
  toggleStudentStatus,
} = require("../controllers/studentController");

router.get("/", getAllStudents);
router.get("/:id", getStudentById);
router.post("/register", registerStudent);
router.put("/:id", updateStudent);
router.patch("/:id/toggle-status", toggleStudentStatus);
router.delete("/:id", deleteStudent);

module.exports = router;
