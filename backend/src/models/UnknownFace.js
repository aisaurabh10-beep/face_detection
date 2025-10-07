const mongoose = require("mongoose");

const UnknownFaceSchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      required: true,
      default: Date.now
    },
    cameraId: {
      type: String,
      required: true
    },
    photo: {
      type: String,
      required: true
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0
    },
    location: {
      type: String,
      default: ""
    },
    processed: {
      type: Boolean,
      default: false
    },
    adminNotes: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true,
    collection: "unknown_faces"
  }
);

// Index for better query performance
UnknownFaceSchema.index({ timestamp: -1 });
UnknownFaceSchema.index({ cameraId: 1 });
UnknownFaceSchema.index({ processed: 1 });

module.exports = mongoose.model("UnknownFace", UnknownFaceSchema);
