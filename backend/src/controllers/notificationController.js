const UnknownFace = require("../models/UnknownFace");

// Get unread notification count (unknown faces)
const getUnreadCount = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const unreadCount = await UnknownFace.countDocuments({
      timestamp: { $gte: startOfDay, $lte: endOfDay },
      processed: false,
    });

    res.json({
      success: true,
      data: { unreadCount },
    });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res.status(500).json({
      error: true,
      message: "Error fetching unread count",
    });
  }
};

// Get recent notifications (unknown faces)
const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const notifications = await UnknownFace.find({
      timestamp: { $gte: startOfDay, $lte: endOfDay },
    })
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await UnknownFace.countDocuments({
      timestamp: { $gte: startOfDay, $lte: endOfDay },
    });

    res.json({
      success: true,
      data: {
        notifications,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      error: true,
      message: "Error fetching notifications",
    });
  }
};

// Mark notifications as read (mark unknown faces as processed)
const markAsRead = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({
        error: true,
        message: "Invalid IDs provided",
      });
    }

    const result = await UnknownFace.updateMany(
      { _id: { $in: ids } },
      { processed: true }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} notifications marked as read`,
      data: { modifiedCount: result.modifiedCount },
    });
  } catch (error) {
    console.error("Error marking notifications as read:", error);
    res.status(500).json({
      error: true,
      message: "Error marking notifications as read",
    });
  }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const result = await UnknownFace.updateMany(
      {
        timestamp: { $gte: startOfDay, $lte: endOfDay },
        processed: false,
      },
      { processed: true }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} notifications marked as read`,
      data: { modifiedCount: result.modifiedCount },
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({
      error: true,
      message: "Error marking all notifications as read",
    });
  }
};

module.exports = {
  getUnreadCount,
  getNotifications,
  markAsRead,
  markAllAsRead,
};
