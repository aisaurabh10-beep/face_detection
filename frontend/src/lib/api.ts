import { axiosInstance } from "@/config/http";

export interface Student {
  _id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  class: string;
  division: string;
  rollNumber: string;
  photos?: string[];
  photoDir?: string;
  // embedding?: number[];
  isActive: boolean;
  lastSeen?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Attendance {
  _id: string;
  studentId: Student;
  date: string;
  entryTime?: string;
  exitTime?: string;
  status: "present" | "late" | "absent";
  cameraId: string;
  confidence: number;
  faceImageUrl?: string;
  location?: string;
  createdAt: string;
}

export interface UnknownFace {
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

export interface AttendanceStats {
  totalStudents: number;
  presentStudents: number;
  absentStudents: number;
  attendancePercentage: number;
  attendanceByClass: Array<{
    _id: string;
    count: number;
  }>;
  date: string;
}

class ApiClient {
  private axios = axiosInstance;

  // Student API
  async getStudents(params?: {
    page?: number;
    limit?: number;
    class?: string;
    division?: string;
    rollNumber?: string;
    email?: string;
    name?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append("page", params.page.toString());
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    if (params?.class) searchParams.append("class", params.class);
    if (params?.division) searchParams.append("division", params.division);
    if (params?.rollNumber)
      searchParams.append("rollNumber", params.rollNumber);
    if (params?.email) searchParams.append("email", params.email);
    if (params?.name) searchParams.append("name", params.name);

    const query = searchParams.toString();
    const url = `/students${query ? `?${query}` : ""}`;
    return this.axios.get(url);
  }

  async getStudent(id: string) {
    return this.axios.get(`/students/${id}`);
  }

  async registerStudent(studentData: FormData) {
    return this.axios.post("/students/register", studentData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  }

  async updateStudent(id: string, studentData: Partial<Student>) {
    return this.axios.put(`/students/${id}`, studentData);
  }

  async deleteStudent(id: string) {
    return this.axios.delete(`/students/${id}`);
  }

  async toggleStudentStatus(id: string) {
    return this.axios.patch(`/students/${id}/toggle-status`);
  }

  // Attendance API
  async markAttendance(attendanceData: {
    studentId: string;
    cameraId: string;
    confidence?: number;

  }) {
    return this.axios.post("/attendance/mark", attendanceData);
  }

  async getTodayAttendance(params?: {
    page?: number;
    limit?: number;
    class?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append("page", params.page.toString());
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    if (params?.class) searchParams.append("class", params.class);

    const query = searchParams.toString();
    return this.axios.get(`/attendance/today${query ? `?${query}` : ""}`);
  }

  async getStudentAttendance(
    studentId: string,
    params?: {
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const searchParams = new URLSearchParams();
    if (params?.startDate) searchParams.append("startDate", params.startDate);
    if (params?.endDate) searchParams.append("endDate", params.endDate);
    if (params?.page) searchParams.append("page", params.page.toString());
    if (params?.limit) searchParams.append("limit", params.limit.toString());

    const query = searchParams.toString();
    return this.axios.get(
      `/attendance/student/${studentId}${query ? `?${query}` : ""}`
    );
  }

  async getAttendanceStats(date?: string, controller?: AbortController) {
    const searchParams = new URLSearchParams();
    if (date) searchParams.append("date", date);

    const query = searchParams.toString();
    return this.axios.get(`/attendance/stats${query ? `?${query}` : ""}`, {
      signal: controller?.signal,
    });
  }

  async getDailyClassWise(date?: string, controller?: AbortController) {
    const searchParams = new URLSearchParams();
    if (date) searchParams.append("date", date);
    const query = searchParams.toString();
    return this.axios.get(
      `/attendance/daily-classwise${query ? `?${query}` : ""}`,
      {
        signal: controller?.signal,
      }
    );
  }

  async getAttendanceReport(params?: {
    page?: number;
    limit?: number;
    class?: string;
    division?: string;
    rollNumber?: string;
    name?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append("page", params.page.toString());
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    if (params?.class) searchParams.append("class", params.class);
    if (params?.division) searchParams.append("division", params.division);
    if (params?.rollNumber)
      searchParams.append("rollNumber", params.rollNumber);
    if (params?.name) searchParams.append("name", params.name);
    if (params?.startDate) searchParams.append("startDate", params.startDate);
    if (params?.endDate) searchParams.append("endDate", params.endDate);

    const query = searchParams.toString();
    return this.axios.get(`/attendance/report${query ? `?${query}` : ""}`);
  }

  // Unknown Faces API
  async logUnknownFace(unknownFaceData: FormData) {
    return this.axios.post("/unknown-faces/log", unknownFaceData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  }

  async getUnknownFaces(params?: {
    page?: number;
    limit?: number;
    processed?: boolean;
    cameraId?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append("page", params.page.toString());
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    if (params?.processed !== undefined)
      searchParams.append("processed", params.processed.toString());
    if (params?.cameraId) searchParams.append("cameraId", params.cameraId);

    const query = searchParams.toString();
    return this.axios.get(`/unknown-faces${query ? `?${query}` : ""}`);
  }

  async markUnknownFaceAsProcessed(id: string, adminNotes?: string) {
    return this.axios.put(`/unknown-faces/${id}/process`, { adminNotes });
  }

  async deleteUnknownFace(id: string) {
    return this.axios.delete(`/unknown-faces/${id}`);
  }

  // Notification API
  async getUnreadCount() {
    return this.axios.get("/notifications/unread-count");
  }

  async getNotifications(params?: { page?: number; limit?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append("page", params.page.toString());
    if (params?.limit) searchParams.append("limit", params.limit.toString());

    const query = searchParams.toString();
    return this.axios.get(`/notifications${query ? `?${query}` : ""}`);
  }

  async markNotificationsAsRead(ids: string[]) {
    return this.axios.patch("/notifications/mark-read", { ids });
  }

  async markAllNotificationsAsRead() {
    return this.axios.patch("/notifications/mark-all-read");
  }

  // Health check
  async getHealth() {
    return this.axios.get(`/health`);
  }
}

export const api = new ApiClient();
