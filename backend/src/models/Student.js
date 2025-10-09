const mongoose = require("mongoose");

const StudentSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      required: true,
      trim: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    class: {
      type: String,
      required: true,
      trim: true,
    },
    division: {
      type: String,
      required: true,
      trim: true,
    },
    rollNumber: {
      type: String,
      required: true,
      trim: true,
    },
    photos: {
      type: [String],
      default: [],
      validate: {
        validator: function (arr) {
          return Array.isArray(arr) && arr.length >= 1;
        },
        message: "At least one photo is required",
      },
    },
    photoDir: {
      type: String,
      default: "",
      trim: true,
    },
    // embedding: {
    //   type: [Number],
    // },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: "students",
  }
);

// Index for better query performance
StudentSchema.index({ studentId: 1 });
StudentSchema.index({ email: 1 });
StudentSchema.index({ isActive: 1 });

// Virtual for full name
StudentSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Ensure virtual fields are serialized
StudentSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("Student", StudentSchema);
