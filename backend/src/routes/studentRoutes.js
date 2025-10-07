const express = require("express");
const router = express.Router();
const {
  getAllStudents,
  getStudentById,
  registerStudent,
  updateStudent,
  deleteStudent,
} = require("../controllers/studentController");
const { validateStudent } = require("../middleware/validation");

router.get("/", getAllStudents);
router.get("/:id", getStudentById);
router.post("/register", registerStudent);
router.put("/:id", updateStudent);
router.delete("/:id", deleteStudent);

module.exports = router;
