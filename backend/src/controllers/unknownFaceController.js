const UnknownFace = require("../models/UnknownFace");
const { unknownUpload } = require("../middleware/upload");

// Log unknown face
const logUnknownFace = async (req, res) => {
  try {
    unknownUpload.single("photo")(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          error: true,
          message: err.message
        });
      }
      
      const { cameraId, confidence, location } = req.body;
      
      const unknownFaceData = {
        cameraId,
        confidence: confidence || 0,
        location: location || "",
        photo: req.file ? req.file.path : ""
      };
      
      const unknownFace = new UnknownFace(unknownFaceData);
      await unknownFace.save();
      
      // Emit real-time update
      req.io.emit("unknown_face_detected", {
        unknownFace,
        message: "Unknown face detected"
      });
      
      res.status(201).json({
        success: true,
        message: "Unknown face logged successfully",
        data: unknownFace
      });
    });
  } catch (error) {
    console.error("Error logging unknown face:", error);
    res.status(500).json({
      error: true,
      message: "Error logging unknown face"
    });
  }
};

// Get all unknown faces
const getAllUnknownFaces = async (req, res) => {
  try {
    const { page = 1, limit = 10, processed, cameraId } = req.query;
    
    const filter = {};
    if (processed !== undefined) filter.processed = processed === "true";
    if (cameraId) filter.cameraId = cameraId;
    
    const unknownFaces = await UnknownFace.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();
    
    const total = await UnknownFace.countDocuments(filter);
    
    res.json({
      success: true,
      data: {
        unknownFaces,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching unknown faces:", error);
    res.status(500).json({
      error: true,
      message: "Error fetching unknown faces"
    });
  }
};

// Get unknown face by ID
const getUnknownFaceById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const unknownFace = await UnknownFace.findById(id);
    
    if (!unknownFace) {
      return res.status(404).json({
        error: true,
        message: "Unknown face record not found"
      });
    }
    
    res.json({
      success: true,
      data: unknownFace
    });
  } catch (error) {
    console.error("Error fetching unknown face:", error);
    res.status(500).json({
      error: true,
      message: "Error fetching unknown face"
    });
  }
};

// Mark unknown face as processed
const markAsProcessed = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNotes } = req.body;
    
    const unknownFace = await UnknownFace.findByIdAndUpdate(
      id,
      { 
        processed: true,
        adminNotes: adminNotes || ""
      },
      { new: true }
    );
    
    if (!unknownFace) {
      return res.status(404).json({
        error: true,
        message: "Unknown face record not found"
      });
    }
    
    res.json({
      success: true,
      message: "Unknown face marked as processed",
      data: unknownFace
    });
  } catch (error) {
    console.error("Error updating unknown face:", error);
    res.status(500).json({
      error: true,
      message: "Error updating unknown face"
    });
  }
};

// Delete unknown face
const deleteUnknownFace = async (req, res) => {
  try {
    const { id } = req.params;
    
    const unknownFace = await UnknownFace.findByIdAndDelete(id);
    
    if (!unknownFace) {
      return res.status(404).json({
        error: true,
        message: "Unknown face record not found"
      });
    }
    
    res.json({
      success: true,
      message: "Unknown face deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting unknown face:", error);
    res.status(500).json({
      error: true,
      message: "Error deleting unknown face"
    });
  }
};

module.exports = {
  logUnknownFace,
  getAllUnknownFaces,
  getUnknownFaceById,
  markAsProcessed,
  deleteUnknownFace
};
