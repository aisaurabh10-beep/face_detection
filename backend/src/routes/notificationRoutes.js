const express = require("express");
const router = express.Router();
const {
  getUnreadCount,
  getNotifications,
  markAsRead,
  markAllAsRead,
} = require("../controllers/notificationController");

router.get("/unread-count", getUnreadCount);
router.get("/", getNotifications);
router.patch("/mark-read", markAsRead);
router.patch("/mark-all-read", markAllAsRead);

module.exports = router;
