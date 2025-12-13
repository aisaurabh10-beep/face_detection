const mongoose = require("mongoose");
const config = require("./config");

const connectDB = async () => {
  try {
    await mongoose.connect(config.MONGODB_URI);
    console.log("✅ Database connected successfully");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    if (config.NODE_ENV === "production") {
      process.exit(1);
    }
  }
};

module.exports = connectDB;
