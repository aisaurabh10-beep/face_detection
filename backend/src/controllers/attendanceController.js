const Attendance = require("../models/Attendance");
const Student = require("../models/Student");
const UnknownFace = require("../models/UnknownFace");

// Mark attendance
const markAttendance = async (req, res) => {
  try {
    const { studentId, cameraId, confidence, faceImageUrl, location } =
      req.body;

    // Find the student
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        error: true,
        message: "Student not found",
      });
    }

    // Get today's date (start and end of day)
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    // Check if attendance already exists for today
    let attendance = await Attendance.findOne({
      studentId,
      date: { $gte: startOfDay, $lte: endOfDay },
    });

    const now = new Date();

    if (attendance) {
      // Update existing attendance
      if (!attendance.exitTime) {
        attendance.exitTime = now;
        attendance.status = "present";
      }
      attendance.confidence = confidence;
      if (faceImageUrl) attendance.faceImageUrl = faceImageUrl;

      await attendance.save();
    } else {
      // Create new attendance record
      attendance = new Attendance({
        studentId,
        date: now,
        entryTime: now,
        cameraId,
        confidence,
        faceImageUrl: faceImageUrl || "",
        location: location || "",
        status: "present",
      });

      await attendance.save();
    }

    // Update student's last seen
    await Student.findByIdAndUpdate(studentId, { lastSeen: now });

    // Populate student data for response
    await attendance.populate(
      "studentId",
      "firstName lastName studentId class rollNumber photo"
    );

    // Emit real-time update
    req.io.emit("attendance_marked", {
      attendance,
      student: attendance.studentId,
      message: "Attendance marked successfully",
    });

    res.json({
      success: true,
      message: "Attendance marked successfully",
      data: attendance,
    });
  } catch (error) {
    console.error("Error marking attendance:", error);
    res.status(500).json({
      error: true,
      message: "Error marking attendance",
    });
  }
};

// Get today's attendance
const getTodayAttendance = async (req, res) => {
  try {
    const { page = 1, limit = 10, class: studentClass } = req.query;

    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const filter = {
      date: { $gte: startOfDay, $lte: endOfDay },
    };

    if (studentClass) {
      const students = await Student.find({ class: studentClass }).select(
        "_id"
      );
      filter.studentId = { $in: students.map((s) => s._id) };
    }

    const attendance = await Attendance.find(filter)
      .populate(
        "studentId",
        "firstName lastName studentId class rollNumber photo"
      )
      .sort({ entryTime: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Attendance.countDocuments(filter);

    res.json({
      success: true,
      data: {
        attendance,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching today's attendance:", error);
    res.status(500).json({
      error: true,
      message: "Error fetching today's attendance",
    });
  }
};

// Get student attendance history
const getStudentAttendance = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { startDate, endDate, page = 1, limit = 10 } = req.query;

    const filter = { studentId };

    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const attendance = await Attendance.find(filter)
      .populate("studentId", "firstName lastName studentId class rollNumber")
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Attendance.countDocuments(filter);

    res.json({
      success: true,
      data: {
        attendance,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching student attendance:", error);
    res.status(500).json({
      error: true,
      message: "Error fetching student attendance",
    });
  }
};

const getAttendanceStats = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    const totalStudents = await Student.countDocuments({ isActive: true });
    const presentStudents = await Attendance.countDocuments({
      date: { $gte: startOfDay, $lte: endOfDay },
      status: "present",
    });
    const unknownFacesToday = await UnknownFace.countDocuments({
      timestamp: { $gte: startOfDay, $lte: endOfDay },
    });

    const stats = {
      totalStudents,
      presentStudents,
      absentStudents: totalStudents - presentStudents,
      attendancePercentage:
        totalStudents > 0 ? (presentStudents / totalStudents) * 100 : 0,
      unknownFacesToday,
      date: targetDate,
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching attendance stats:", error);
    res.status(500).json({
      error: true,
      message: "Error fetching attendance stats",
    });
  }
};

// Get per-class stats for a specific day along with summary in one call
const getDailyClassWise = async (req, res) => {
  try {
    const { date } = req.query;
    const target = date ? new Date(date) : new Date();
    const startOfDay = new Date(target.setHours(0, 0, 0, 0));
    const endOfDay = new Date(target.setHours(23, 59, 59, 999));

    // Fetch students grouped by class
    const students = await Student.find({ isActive: true })
      .select("_id class")
      .lean();
    const classToStudentIds = new Map();
    for (const s of students) {
      const cls = s.class || "Unknown";
      if (!classToStudentIds.has(cls)) classToStudentIds.set(cls, []);
      classToStudentIds.get(cls).push(s._id);
    }

    // Present attendance for day grouped by student
    const presentAttendance = await Attendance.aggregate([
      {
        $match: {
          date: { $gte: startOfDay, $lte: endOfDay },
          status: "present",
        },
      },
      { $group: { _id: "$studentId" } },
    ]);
    const presentSet = new Set(presentAttendance.map((p) => String(p._id)));

    const classes = [];
    let totalPresent = 0;
    let totalStudents = 0;
    for (const [cls, ids] of classToStudentIds.entries()) {
      const total = ids.length;
      const present = ids.reduce(
        (acc, id) => (presentSet.has(String(id)) ? acc + 1 : acc),
        0
      );
      const absent = Math.max(total - present, 0);
      totalPresent += present;
      totalStudents += total;
      const presentPercentage = total > 0 ? (present / total) * 100 : 0;
      const absentPercentage = total > 0 ? (absent / total) * 100 : 0;
      classes.push({
        className: cls,
        present,
        absent,
        total,
        presentPercentage,
        absentPercentage,
      });
    }

    // Unknown faces for the day
    const unknownFaces = await UnknownFace.countDocuments({
      timestamp: { $gte: startOfDay, $lte: endOfDay },
    });

    const avgPresentPercentage = classes.length
      ? classes.reduce(
          (sum, c) => sum + (c.total > 0 ? (c.present / c.total) * 100 : 0),
          0
        ) / classes.length
      : 0;

    const summary = {
      date: new Date(startOfDay),
      unknownFaces,
      averagePresentPercentage: avgPresentPercentage,
      totalAbsent: Math.max(totalStudents - totalPresent, 0),
      totalAbsentPercentage:
        totalStudents > 0
          ? ((totalStudents - totalPresent) / totalStudents) * 100
          : 0,
      totalPresent: totalPresent,
      totalPresentPercentage:
        totalStudents > 0 ? (totalPresent / totalStudents) * 100 : 0,
    };

    res
      .status(200)
      .json({ success: true, data: { date: startOfDay, classes, summary } });
  } catch (error) {
    console.error("Error fetching daily class-wise stats:", error);
    res
      .status(500)
      .json({ error: true, message: "Error fetching daily class-wise stats" });
  }
};

// Get attendance report with filters and date range
const getAttendanceReport = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      class: studentClass,
      division,
      rollNumber,
      name,
      startDate,
      endDate,
    } = req.query;

    // Build student filter
    const studentFilter = { isActive: true };
    if (studentClass) studentFilter.class = studentClass;
    if (division) studentFilter.division = division;
    if (rollNumber) studentFilter.rollNumber = rollNumber;
    if (name) {
      studentFilter.$or = [
        { firstName: { $regex: name, $options: "i" } },
        { lastName: { $regex: name, $options: "i" } },
      ];
    }

    // Get all students matching the filter
    const students = await Student.find(studentFilter)
      .select("_id firstName lastName class division rollNumber photos")
      .lean();

    if (students.length === 0) {
      return res.json({
        success: true,
        data: {
          reports: [],
          total: 0,
          page: parseInt(page),
          pages: 0,
        },
      });
    }

    const studentIds = students.map((s) => s._id);

    // Build attendance date filter
    let attendanceDateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      attendanceDateFilter = {
        date: { $gte: start, $lte: end },
      };
    }

    // Calculate total working days in the date range
    let totalWorkingDays = 0;
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      // Count working days (Monday to Friday) in the date range
      let currentDate = new Date(start);
      while (currentDate <= end) {
        const dayOfWeek = currentDate.getDay();
        // Monday = 1, Tuesday = 2, ..., Friday = 5
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          totalWorkingDays++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else {
      // If no date range specified, default to current month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      let currentDate = new Date(startOfMonth);
      while (currentDate <= endOfMonth) {
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          totalWorkingDays++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    // Get attendance data for all students in the date range
    const attendanceData = await Attendance.aggregate([
      {
        $match: {
          studentId: { $in: studentIds },
          ...attendanceDateFilter,
        },
      },
      {
        $group: {
          _id: "$studentId",
          presentDays: {
            $sum: {
              $cond: [{ $eq: ["$status", "present"] }, 1, 0],
            },
          },
          absentDays: {
            $sum: {
              $cond: [{ $eq: ["$status", "absent"] }, 1, 0],
            },
          },
        },
      },
    ]);

    // Create a map for quick lookup
    const attendanceMap = {};
    attendanceData.forEach((item) => {
      const presentDays = item.presentDays || 0;
      const absentDays = totalWorkingDays - presentDays; // Calculate absent days as total working days minus present days
      const totalDays = totalWorkingDays;

      attendanceMap[item._id.toString()] = {
        totalDays,
        presentDays,
        absentDays,
        presentPercentage: totalDays > 0 ? (presentDays / totalDays) * 100 : 0,
        absentPercentage: totalDays > 0 ? (absentDays / totalDays) * 100 : 0,
      };
    });

    // Combine student data with attendance data
    const reports = students.map((student) => {
      const attendance = attendanceMap[student._id.toString()] || {
        totalDays: totalWorkingDays,
        presentDays: 0,
        absentDays: totalWorkingDays, // If no attendance records, all days are absent
        presentPercentage: 0,
        absentPercentage: 100, // If no attendance records, 100% absent
      };

      return {
        student,
        ...attendance,
      };
    });

    // Apply pagination
    const total = reports.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedReports = reports.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        reports: paginatedReports,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching attendance report:", error);
    res.status(500).json({
      error: true,
      message: "Error fetching attendance report",
    });
  }
};

module.exports = {
  markAttendance,
  getTodayAttendance,
  getStudentAttendance,
  getAttendanceStats,
  getDailyClassWise,
  getAttendanceReport,
};
