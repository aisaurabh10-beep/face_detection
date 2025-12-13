const UnknownFace = require("../models/UnknownFace");
const { unknownUpload } = require("../middleware/upload");
const config = require("../config/config");

// Log unknown face
const logUnknownFace = async (req, res) => {
  try {
    unknownUpload.single("photo")(req, res, async (err) => {
      if (err) {
        return res.status(config.HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: true,
          message: err.message || config.MESSAGES.ERROR.FILE_UPLOAD_ERROR,
        });
      }

      const { cameraId, confidence, location } = req.body;

      const unknownFaceData = {
        cameraId,
        confidence: confidence || 0,
        location: location || "",
        photo: req.file ? req.file.path : "",
      };

      const unknownFace = new UnknownFace(unknownFaceData);
      await unknownFace.save();

      // Emit real-time update
      req.io.emit("unknown_face_detected", {
        unknownFace,
        message: config.MESSAGES.SUCCESS.UNKNOWN_FACE_LOGGED,
      });

      res.status(config.HTTP_STATUS.CREATED).json({
        success: true,
        message: config.MESSAGES.SUCCESS.UNKNOWN_FACE_LOGGED,
        data: unknownFace,
      });
    });
  } catch (error) {
    res.status(config.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: true,
      message: config.MESSAGES.ERROR.INTERNAL_SERVER,
    });
  }
};

// Get all unknown faces
const getAllUnknownFaces = async (req, res) => {
  try {
    const {
      page = config.DEFAULT_PAGE,
      limit = config.DEFAULT_LIMIT,
      processed,
      cameraId,
    } = req.query;

    const filter = {};
    if (processed !== undefined) filter.processed = processed === "true";
    if (cameraId) filter.cameraId = cameraId;

    const unknownFaces = await UnknownFace.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await UnknownFace.countDocuments(filter);

    res.status(config.HTTP_STATUS.OK).json({
      success: true,
      data: {
        unknownFaces,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(config.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: true,
      message: config.MESSAGES.ERROR.INTERNAL_SERVER,
    });
  }
};

// Get unknown face by ID
const getUnknownFaceById = async (req, res) => {
  try {
    const { id } = req.params;

    const unknownFace = await UnknownFace.findById(id);

    if (!unknownFace) {
      return res.status(config.HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: true,
        message: config.MESSAGES.ERROR.UNKNOWN_FACE_NOT_FOUND,
      });
    }

    res.status(config.HTTP_STATUS.OK).json({
      success: true,
      data: unknownFace,
    });
  } catch (error) {
    res.status(config.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: true,
      message: config.MESSAGES.ERROR.INTERNAL_SERVER,
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
        adminNotes: adminNotes || "",
      },
      { new: true }
    );

    if (!unknownFace) {
      return res.status(config.HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: true,
        message: config.MESSAGES.ERROR.UNKNOWN_FACE_NOT_FOUND,
      });
    }

    res.status(config.HTTP_STATUS.OK).json({
      success: true,
      message: config.MESSAGES.SUCCESS.UNKNOWN_FACE_PROCESSED,
      data: unknownFace,
    });
  } catch (error) {
    res.status(config.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: true,
      message: config.MESSAGES.ERROR.INTERNAL_SERVER,
    });
  }
};

// Delete unknown face
const deleteUnknownFace = async (req, res) => {
  try {
    const { id } = req.params;

    const unknownFace = await UnknownFace.findByIdAndDelete(id);

    if (!unknownFace) {
      return res.status(config.HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: true,
        message: config.MESSAGES.ERROR.UNKNOWN_FACE_NOT_FOUND,
      });
    }

    res.status(config.HTTP_STATUS.OK).json({
      success: true,
      message: config.MESSAGES.SUCCESS.UNKNOWN_FACE_DELETED,
    });
  } catch (error) {
    res.status(config.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: true,
      message: config.MESSAGES.ERROR.INTERNAL_SERVER,
    });
  }
};

module.exports = {
  logUnknownFace,
  getAllUnknownFaces,
  getUnknownFaceById,
  markAsProcessed,
  deleteUnknownFace,
};
