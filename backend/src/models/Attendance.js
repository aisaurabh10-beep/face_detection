const mongoose = require("mongoose");

const AttendanceSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true
    },
    date: {
      type: Date,
      required: true,
      default: Date.now
    },
    entryTime: {
      type: Date,
      default: null
    },
    exitTime: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: ["present", "late", "absent"],
      default: "present"
    },
    cameraId: {
      type: String,
      // required: true
      default: "camera1"
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0
    },
    deepface_distance: {
      type: Number
      
    },
    location: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true,
    collection: "attendance"
  }
);

// Index for better query performance
AttendanceSchema.index({ studentId: 1, date: 1 });
AttendanceSchema.index({ date: 1 });
AttendanceSchema.index({ cameraId: 1 });
AttendanceSchema.index({ status: 1 });

// Virtual for duration (if both entry and exit times exist)
AttendanceSchema.virtual("duration").get(function() {
  if (this.entryTime && this.exitTime) {
    return this.exitTime - this.entryTime;
  }
  return null;
});

// Ensure virtual fields are serialized
AttendanceSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("Attendance", AttendanceSchema);
