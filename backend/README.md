# Attendance Backend POC

A simplified backend for the Student Attendance System Proof of Concept.

## Features

- **Student Management**: Register, update, and manage student profiles
- **Attendance Tracking**: Mark and track student attendance
- **Unknown Face Logging**: Log unrecognized faces for review
- **Real-time Updates**: WebSocket integration for live updates
- **File Upload**: Handle student photos and unknown face images

## Tech Stack

- Node.js + Express.js
- MongoDB + Mongoose
- Socket.IO for real-time communication
- Multer for file uploads
- UUID for unique identifiers

## Project Structure

```
backend/
├── src/
│   ├── controllers/          # Request handlers
│   │   ├── studentController.js
│   │   ├── attendanceController.js
│   │   └── unknownFaceController.js
│   ├── models/              # Database schemas
│   │   ├── Student.js
│   │   ├── Attendance.js
│   │   └── UnknownFace.js
│   ├── routes/              # API routes
│   │   ├── studentRoutes.js
│   │   ├── attendanceRoutes.js
│   │   └── unknownFaceRoutes.js
│   ├── middleware/          # Custom middleware
│   │   ├── upload.js
│   │   └── validation.js
│   ├── services/            # Business logic services
│   └── config/              # Configuration files
│       ├── database.js
│       └── config.js
├── uploads/                 # File upload directory
│   ├── students/
│   └── unknown/
├── server.js               # Main server file
└── package.json
```

## API Endpoints

### Students
- `GET /api/students` - Get all students
- `GET /api/students/:id` - Get student by ID
- `POST /api/students/register` - Register new student
- `PUT /api/students/:id` - Update student
- `DELETE /api/students/:id` - Delete student

### Attendance
- `POST /api/attendance/mark` - Mark attendance
- `GET /api/attendance/today` - Get today's attendance
- `GET /api/attendance/student/:studentId` - Get student attendance history
- `GET /api/attendance/stats` - Get attendance statistics

### Unknown Faces
- `POST /api/unknown-faces/log` - Log unknown face
- `GET /api/unknown-faces` - Get all unknown faces
- `GET /api/unknown-faces/:id` - Get unknown face by ID
- `PUT /api/unknown-faces/:id/process` - Mark as processed
- `DELETE /api/unknown-faces/:id` - Delete unknown face

### Health Check
- `GET /api/health` - Server health status

## WebSocket Events

### Emitted Events
- `student_registered` - When a new student is registered
- `attendance_marked` - When attendance is marked
- `unknown_face_detected` - When an unknown face is detected

## Installation & Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start MongoDB**
   Make sure MongoDB is running on `mongodb://127.0.0.1:27017`

3. **Start the Server**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

4. **Server will start on**
   - HTTP: `http://localhost:5000`
   - Health Check: `http://localhost:5000/api/health`

## Environment Variables

Create a `.env` file in the root directory:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/attendance_poc
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

## Database Schema

### Student
- `studentId`: Unique student identifier
- `firstName`, `lastName`: Student name
- `email`, `phone`: Contact information
- `class`, `rollNumber`: Academic information
- `photo`: Profile photo path
- `faceEncoding`: Face recognition data
- `isActive`: Account status
- `lastSeen`: Last activity timestamp

### Attendance
- `studentId`: Reference to Student
- `date`: Attendance date
- `entryTime`, `exitTime`: Time stamps
- `status`: present/late/absent
- `cameraId`: Camera identifier
- `confidence`: Recognition confidence
- `faceImageUrl`: Captured face image
- `location`: Camera location

### UnknownFace
- `timestamp`: Detection time
- `cameraId`: Camera identifier
- `photo`: Face image path
- `confidence`: Detection confidence
- `location`: Camera location
- `processed`: Admin review status
- `adminNotes`: Admin comments

## File Upload

- **Student Photos**: Stored in `uploads/students/`
- **Unknown Faces**: Stored in `uploads/unknown/`
- **Supported Formats**: JPEG, PNG, JPG
- **Max File Size**: 5MB

## Real-time Features

The backend uses Socket.IO to provide real-time updates:

- Live attendance notifications
- Student registration alerts
- Unknown face detection alerts
- System status updates

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": true,
  "message": "Error description",
  "details": ["Additional error details"]
}
```

## Success Responses

All successful operations return:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": { /* response data */ }
}
```

## Development Notes

- No authentication required for POC
- File uploads are stored locally
- WebSocket connections are open to all origins in development
- Database indexes are optimized for common queries
- All timestamps are in UTC
