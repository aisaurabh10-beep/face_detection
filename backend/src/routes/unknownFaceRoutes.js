const express = require("express");
const router = express.Router();
const {
  logUnknownFace,
  getAllUnknownFaces,
  getUnknownFaceById,
  markAsProcessed,
  deleteUnknownFace,
} = require("../controllers/unknownFaceController");
const { validateUnknownFace } = require("../middleware/validation");

router.post("/log", validateUnknownFace, logUnknownFace);
router.get("/", getAllUnknownFaces);
router.get("/:id", getUnknownFaceById);
router.put("/:id/process", markAsProcessed);
router.delete("/:id", deleteUnknownFace);

module.exports = router;
