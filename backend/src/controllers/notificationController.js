const UnknownFace = require("../models/UnknownFace");
const config = require("../config/config");

// Get unread notification count (unknown faces)
const getUnreadCount = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const unreadCount = await UnknownFace.countDocuments({
      timestamp: { $gte: startOfDay, $lte: endOfDay },
      processed: false,
    });

    res.status(config.HTTP_STATUS.OK).json({
      success: true,
      data: { unreadCount },
    });
  } catch (error) {
    res.status(config.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: true,
      message: config.MESSAGES.ERROR.INTERNAL_SERVER,
    });
  }
};

// Get recent notifications (unknown faces)
const getNotifications = async (req, res) => {
  try {
    const { page = config.DEFAULT_PAGE, limit = config.DEFAULT_LIMIT } =
      req.query;

    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

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

    res.status(config.HTTP_STATUS.OK).json({
      success: true,
      data: {
        notifications,
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

// Mark notifications as read (mark unknown faces as processed)
const markAsRead = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids)) {
      return res.status(config.HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: true,
        message: config.MESSAGES.ERROR.INVALID_IDS,
      });
    }

    const result = await UnknownFace.updateMany(
      { _id: { $in: ids } },
      { processed: true }
    );

    res.status(config.HTTP_STATUS.OK).json({
      success: true,
      message: config.MESSAGES.SUCCESS.NOTIFICATIONS_MARKED_READ,
      data: { modifiedCount: result.modifiedCount },
    });
  } catch (error) {
    res.status(config.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: true,
      message: config.MESSAGES.ERROR.INTERNAL_SERVER,
    });
  }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await UnknownFace.updateMany(
      {
        timestamp: { $gte: startOfDay, $lte: endOfDay },
        processed: false,
      },
      { processed: true }
    );

    res.status(config.HTTP_STATUS.OK).json({
      success: true,
      message: config.MESSAGES.SUCCESS.NOTIFICATIONS_MARKED_READ,
      data: { modifiedCount: result.modifiedCount },
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
  getUnreadCount,
  getNotifications,
  markAsRead,
  markAllAsRead,
};
