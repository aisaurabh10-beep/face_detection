const mongoose = require("mongoose");
const config = require("./config");

const connectDB = async () => {
  try {
    const mongoURI =
     config.MONGODB_URI || "mongodb://127.0.0.1:27017/attendance_poc";

    await mongoose.connect(mongoURI);

    console.log("✅ MongoDB connected successfully");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
};

module.exports = connectDB;
