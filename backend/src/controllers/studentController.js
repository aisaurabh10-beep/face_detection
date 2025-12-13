const Student = require("../models/Student");
const { studentUpload } = require("../middleware/upload");
const config = require("../config/config");

const getAllStudents = async (req, res) => {
  try {
    const {
      page = config.DEFAULT_PAGE,
      limit = config.DEFAULT_LIMIT,
      class: studentClass,
      division,
      rollNumber,
      email,
      name,
    } = req.query;

    const filter = {};
    if (studentClass) filter.class = studentClass;
    if (division) filter.division = division;
    if (rollNumber) filter.rollNumber = rollNumber;
    if (email) filter.email = email;
    if (name) {
      const regex = new RegExp(name, "i");
      filter.$or = [{ firstName: regex }, { lastName: regex }];
    }

    // Sorting by rollNumber ascending (if numeric strings, cast for sort stability)
    const sort = { rollNumber: 1 };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [students, total] = await Promise.all([
      Student.find(filter).sort(sort).limit(parseInt(limit)).skip(skip).lean(),
      Student.countDocuments(filter),
    ]);

    res.status(config.HTTP_STATUS.OK).json({
      success: true,
      data: {
        students,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
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

const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await Student.findById(id);

    if (!student) {
      return res.status(config.HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: true,
        message: config.MESSAGES.ERROR.STUDENT_NOT_FOUND,
      });
    }

    res.status(config.HTTP_STATUS.OK).json({
      success: true,
      data: student,
    });
  } catch (error) {
    res.status(config.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: true,
      message: config.MESSAGES.ERROR.INTERNAL_SERVER,
    });
  }
};

const registerStudent = async (req, res) => {
  try {
    studentUpload.array("photos", config.MAX_STUDENT_PHOTOS)(
      req,
      res,
      async (err) => {
        if (err) {
          return res.status(config.HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            error: true,
            message: err.message || config.MESSAGES.ERROR.FILE_UPLOAD_ERROR,
          });
        }

        const {
          studentId,
          firstName,
          lastName,
          email,
          phone,
          class: studentClass,
          division,
          rollNumber,
        } = req.body;

        const currentCount = await Student.countDocuments();
        if (currentCount >= Number(config.STUDENT_LIMIT)) {
          return res.status(config.HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            error: true,
            message: config.MESSAGES.ERROR.STUDENT_LIMIT_REACHED,
          });
        }

        // Check if student already exists
        const existingStudent = await Student.findOne({
          $or: [
            { email },
            { studentId },
            { rollNumber, class: studentClass, division },
          ],
        });

        if (existingStudent) {
          return res.status(config.HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            error: true,
            message: config.MESSAGES.ERROR.STUDENT_EXISTS,
          });
        }

        const files = Array.isArray(req.files) ? req.files : [];
        if (!files.length) {
          return res.status(config.HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            error: true,
            message: config.MESSAGES.ERROR.PHOTOS_REQUIRED,
          });
        }
        const photos = files.map((f) => f.path);
        const photoDir = files[0]?.destination || "";

        const studentData = {
          studentId,
          firstName,
          lastName,
          email,
          phone,
          class: studentClass,
          division,
          rollNumber,
          photos,
          photoDir,
        };

        const student = new Student(studentData);
        await student.save();

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(
            () => controller.abort(),
            config.EMBEDDING_SYNC_TIMEOUT
          );

          const response = await fetch(config.SYNC_SUCCESS_STATUS, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();

          if (data && data.success === config.SYNC_SUCCESS_STATUS) {
            req.io.emit("student_registered", {
              student: student,
              message: config.MESSAGES.SUCCESS.STUDENT_REGISTERED,
            });

            return res.status(config.HTTP_STATUS.CREATED).json({
              success: true,
              message: config.MESSAGES.SUCCESS.EMBEDDING_SYNCED,
              data: student,
            });
          } else {
            return res.status(config.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
              success: false,
              error: true,
              message: config.MESSAGES.ERROR.EMBEDDING_SYNC_FAILED,
            });
          }
        } catch (syncError) {
          return res.status(config.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: true,
            message: config.MESSAGES.ERROR.EMBEDDING_API_ERROR,
          });
        }
      }
    );
  } catch (error) {
    res.status(config.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: true,
      message: config.MESSAGES.ERROR.INTERNAL_SERVER,
    });
  }
};

const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const student = await Student.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!student) {
      return res.status(config.HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: true,
        message: config.MESSAGES.ERROR.STUDENT_NOT_FOUND,
      });
    }

    res.status(config.HTTP_STATUS.OK).json({
      success: true,
      message: config.MESSAGES.SUCCESS.STUDENT_UPDATED,
      data: student,
    });
  } catch (error) {
    res.status(config.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: true,
      message: config.MESSAGES.ERROR.INTERNAL_SERVER,
    });
  }
};

const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await Student.findByIdAndDelete(id);

    if (!student) {
      return res.status(config.HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: true,
        message: config.MESSAGES.ERROR.STUDENT_NOT_FOUND,
      });
    }

    res.status(config.HTTP_STATUS.OK).json({
      success: true,
      message: config.MESSAGES.SUCCESS.STUDENT_DELETED,
    });
  } catch (error) {
    res.status(config.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: true,
      message: config.MESSAGES.ERROR.INTERNAL_SERVER,
    });
  }
};

const toggleStudentStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const currentStudent = await Student.findById(id);
    if (!currentStudent) {
      return res.status(config.HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: true,
        message: config.MESSAGES.ERROR.STUDENT_NOT_FOUND,
      });
    }

    const newStatus = !currentStudent.isActive;
    const student = await Student.findByIdAndUpdate(
      id,
      { isActive: newStatus },
      { new: true, runValidators: true }
    );

    req.io.emit("student_updated", {
      student: student,
      message: config.MESSAGES.SUCCESS.STUDENT_STATUS_TOGGLED,
    });

    res.status(config.HTTP_STATUS.OK).json({
      success: true,
      message: config.MESSAGES.SUCCESS.STUDENT_STATUS_TOGGLED,
      data: student,
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
  getAllStudents,
  getStudentById,
  registerStudent,
  updateStudent,
  deleteStudent,
  toggleStudentStatus,
};
