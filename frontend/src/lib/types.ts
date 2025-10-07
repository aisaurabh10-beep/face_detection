export interface QuickStatItem {
  name: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

// Socket related types
export interface SocketStudent {
  _id: string;
  firstName: string;
  lastName: string;
  class: string;
  division?: string;
  rollNumber: string;
  photo?: string;
  photos?: string[];
  photoDir?: string;
}

export interface SocketAttendance {
  _id: string;
  studentId: string;
  date: string;
  entryTime?: string;
  exitTime?: string;
  status: string;
  cameraId: string;
  confidence: number;
}

export interface SocketUnknownFace {
  _id: string;
  timestamp: string;
  cameraId: string;
  photo: string;
  confidence: number;
}

// Notification types
export interface Notification {
  _id: string;
  timestamp: string;
  cameraId: string;
  photo: string;
  confidence: number;
  location?: string;
  processed: boolean;
  adminNotes?: string;
  createdAt: string;
}

export interface NotificationData {
  notifications: Notification[];
  total: number;
  page: number;
  pages: number;
}

export interface UnreadCountData {
  unreadCount: number;
}

export interface SocketEvents {
  attendance_marked: (data: {
    attendance: SocketAttendance;
    student: SocketStudent;
    message: string;
  }) => void;

  student_registered: (data: {
    student: SocketStudent;
    message: string;
  }) => void;

  unknown_face_detected: (data: {
    unknownFace: SocketUnknownFace;
    message: string;
  }) => void;

  connect: () => void;
  disconnect: () => void;
  connect_error: (error: Error) => void;
}

// Class-wise attendance stats (single day)
export interface ClassWiseDailyStat {
  className: string; // e.g., "Class 1"
  present: number;
  absent: number;
  total: number; // enrolled for that class
  presentPercentage?: number;
  absentPercentage?: number;
}

export interface DailyOverviewSummary {
  date: string; // ISO date
  unknownFaces: number;
  averagePresentPercentage: number; // across classes
  totalAbsent: number;
  totalAbsentPercentage: number; // across all students
  totalPresent?: number;
  totalPresentPercentage?: number;
}

export interface DailyClassWiseResponse {
  date: string;
  classes: ClassWiseDailyStat[];
  summary: DailyOverviewSummary;
}
