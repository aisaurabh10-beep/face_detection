const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const socketIo = require("socket.io");
const config = require("./src/config/config");
const { validateLicense } = require("./license");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: config.ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
  },
});

async function startServer() {
  try {
    await validateLicense(); // Block startup until license is validated
    await connectDB();
    server.listen(config.PORT, () => {
      console.log(`🚀 Backend POC running on port ${config.PORT}`);
      console.log(`📊 Health check: http://localhost:${config.PORT}/api/health`);
    });
  } catch (error) {
    console.error("❌ Startup failed:", error.message || error);
    process.exit(1);
  }
}

app.use(
  cors({
    origin: config.ALLOWED_ORIGINS,
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  "/uploads",
  express.static(path.join(__dirname, config.UPLOAD_BASE_DIR))
);

// Make io accessible to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

const studentRoutes = require("./src/routes/studentRoutes");
const attendanceRoutes = require("./src/routes/attendanceRoutes");
const unknownFaceRoutes = require("./src/routes/unknownFaceRoutes");
const notificationRoutes = require("./src/routes/notificationRoutes");
const connectDB = require("./src/config/database");

// Routes
app.use("/api/students", studentRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/unknown-faces", unknownFaceRoutes);
app.use("/api/notifications", notificationRoutes);

app.get("/api/health", (req, res) => {
  res.status(config.HTTP_STATUS.OK).json({
    success: true,
    message: "Server is running",
  });
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log(" 🔌 Client connected: ", socket.id);
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (config.NODE_ENV === "development") {
    console.error("Error:", err);
  }

  const statusCode = err.status || config.HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const message = err.message || config.MESSAGES.ERROR.INTERNAL_SERVER;

  res.status(statusCode).json({
    success: false,
    error: true,
    message:
      config.NODE_ENV === "production" && statusCode === 500
        ? config.MESSAGES.ERROR.INTERNAL_SERVER
        : message,
    ...(config.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(config.HTTP_STATUS.NOT_FOUND).json({
    success: false,
    error: true,
    message: config.MESSAGES.ERROR.NOT_FOUND,
  });
});

startServer();
