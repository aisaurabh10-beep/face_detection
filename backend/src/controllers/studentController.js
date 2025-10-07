const Student = require("../models/Student");
const { studentUpload } = require("../middleware/upload");

// Get all students
const getAllStudents = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      class: studentClass,
      division,
      rollNumber,
      email,
      name,
      isActive,
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
    if (isActive !== undefined) filter.isActive = isActive === "true";

    // Sorting by rollNumber ascending (if numeric strings, cast for sort stability)
    const sort = { rollNumber: 1 };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [students, total, classAgg, divisionAgg] = await Promise.all([
      Student.find(filter).sort(sort).limit(parseInt(limit)).skip(skip).lean(),
      Student.countDocuments(filter),
      Student.distinct("class", filter),
      Student.distinct("division", filter),
    ]);

    res.json({
      success: true,
      data: {
        students,
        total,
        classesCount: classAgg.length,
        divisionsCount: divisionAgg.length,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching students:", error);
    res.status(500).json({
      error: true,
      message: "Error fetching students",
    });
  }
};

// Get student by ID
const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await Student.findById(id);

    if (!student) {
      return res.status(404).json({
        error: true,
        message: "Student not found",
      });
    }

    res.json({
      success: true,
      data: student,
    });
  } catch (error) {
    console.error("Error fetching student:", error);
    res.status(500).json({
      error: true,
      message: "Error fetching student",
    });
  }
};

// Register new student
const registerStudent = async (req, res) => {
  try {
    // Accept up to MAX_UPLOAD photos field named 'photos' (multer parses before validation)
    studentUpload.array("photos", 3)(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          error: true,
          message: err.message,
        });
      }
      console.log("Request Body:", req.body);

      const {
        studentId,
        firstName,
        lastName,
        email,
        phone,
        class: studentClass,
        division,
        rollNumber,
        // faceEncoding
      } = req.body;

      // Check if student already exists
      const existingStudent = await Student.findOne({
        $or: [{ email }, { rollNumber }],
      });

      if (existingStudent) {
        return res.status(400).json({
          error: true,
          message: "Student with this email or roll number already exists",
        });
      }

      // Generate unique student ID
      // const studentId = `STU${Date.now()}${Math.floor(Math.random() * 1000)}`;

      const files = Array.isArray(req.files) ? req.files : [];
      if (!files.length) {
        return res.status(400).json({
          error: true,
          message: "At least one photo is required",
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
        // faceEncoding: faceEncoding ? JSON.parse(faceEncoding) : []
      };

      const student = new Student(studentData);
      await student.save();

      // Emit real-time update
      req.io.emit("student_registered", {
        student: student,
        message: "New student registered",
      });

      res.status(201).json({
        success: true,
        message: "Student registered successfully",
        data: student,
      });
    });
  } catch (error) {
    console.error("Error registering student:", error);
    res.status(500).json({
      error: true,
      message: "Error registering student",
    });
  }
};

// Update student
const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const student = await Student.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!student) {
      return res.status(404).json({
        error: true,
        message: "Student not found",
      });
    }

    res.json({
      success: true,
      message: "Student updated successfully",
      data: student,
    });
  } catch (error) {
    console.error("Error updating student:", error);
    res.status(500).json({
      error: true,
      message: "Error updating student",
    });
  }
};

// Delete student
const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await Student.findByIdAndDelete(id);

    if (!student) {
      return res.status(404).json({
        error: true,
        message: "Student not found",
      });
    }

    res.json({
      success: true,
      message: "Student deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting student:", error);
    res.status(500).json({
      error: true,
      message: "Error deleting student",
    });
  }
};

module.exports = {
  getAllStudents,
  getStudentById,
  registerStudent,
  updateStudent,
  deleteStudent,
};
