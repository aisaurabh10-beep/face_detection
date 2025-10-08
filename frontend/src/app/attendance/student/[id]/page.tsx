"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Calendar,
  User,
  Clock,
  Download,
  FileSpreadsheet,
  BarChart3,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/lib/api";
import { getPicUrl } from "@/lib/helper";

interface Student {
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
  isActive: boolean;
  lastSeen?: string;
  createdAt: string;
}

interface AttendanceRecord {
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

export default function StudentAttendancePage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;

  const [loading, setLoading] = useState(false);
  const [, setErrorMsg] = useState("");
  const [student, setStudent] = useState<Student | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<
    AttendanceRecord[]
  >([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dateRange, setDateRange] = useState("current-month");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [exportLoading, setExportLoading] = useState(false);
  const [attendanceStats, setAttendanceStats] = useState({
    totalWorkingDays: 0,
    presentDays: 0,
    absentDays: 0,
    presentPercentage: 0,
    absentPercentage: 0,
  });

  const limit = 20;

  const getDateRange = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    switch (dateRange) {
      case "current-month":
        return {
          startDate: startOfMonth.toISOString().split("T")[0],
          endDate: endOfMonth.toISOString().split("T")[0],
        };
      case "last-month":
        const lastMonthStart = new Date(
          now.getFullYear(),
          now.getMonth() - 1,
          1
        );
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        return {
          startDate: lastMonthStart.toISOString().split("T")[0],
          endDate: lastMonthEnd.toISOString().split("T")[0],
        };
      case "last-3-months":
        const threeMonthsAgo = new Date(
          now.getFullYear(),
          now.getMonth() - 3,
          1
        );
        return {
          startDate: threeMonthsAgo.toISOString().split("T")[0],
          endDate: now.toISOString().split("T")[0],
        };
      case "last-6-months":
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        return {
          startDate: sixMonthsAgo.toISOString().split("T")[0],
          endDate: now.toISOString().split("T")[0],
        };
      case "current-year":
        const yearStart = new Date(now.getFullYear(), 0, 1);
        const yearEnd = new Date(now.getFullYear(), 11, 31);
        return {
          startDate: yearStart.toISOString().split("T")[0],
          endDate: yearEnd.toISOString().split("T")[0],
        };
      case "last-year":
        const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
        const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31);
        return {
          startDate: lastYearStart.toISOString().split("T")[0],
          endDate: lastYearEnd.toISOString().split("T")[0],
        };
      case "custom":
        return {
          startDate: customStartDate,
          endDate: customEndDate,
        };
      default:
        return {
          startDate: startOfMonth.toISOString().split("T")[0],
          endDate: endOfMonth.toISOString().split("T")[0],
        };
    }
  };

  const calculateWorkingDays = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let workingDays = 0;

    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dayOfWeek = currentDate.getDay();
      // Monday = 1, Tuesday = 2, ..., Friday = 5
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        workingDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return workingDays;
  };

  // Set default date range to current month
  useEffect(() => {
    const { startDate: defaultStart, endDate: defaultEnd } = getDateRange();
    setStartDate(defaultStart);
    setEndDate(defaultEnd);
  }, [dateRange]);

  const fetchStudentData = async () => {
    try {
      const res = await api.getStudent(studentId);
      setStudent(res.data?.data);
    } catch (error) {
      console.error("Failed to load student data:", error);
      setErrorMsg("Failed to load student data");
    }
  };

  const fetchAttendanceData = async () => {
    if (!studentId || !startDate || !endDate) return;

    setLoading(true);
    setErrorMsg("");
    try {
      const res = await api.getStudentAttendance(studentId, {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page,
        limit,
      });
      const data = res.data?.data;
      setAttendanceRecords(data?.attendance || []);
      setTotal(data?.total || 0);

      // Calculate attendance stats
      const allRecords = data?.attendance || [];
      const totalWorkingDays = calculateWorkingDays(startDate, endDate);
      const presentDays = allRecords.filter(
        (record) => record.status === "present"
      ).length;
      const absentDays = totalWorkingDays - presentDays; // Calculate absent days as total working days minus present days

      setAttendanceStats({
        totalWorkingDays,
        presentDays,
        absentDays,
        presentPercentage:
          totalWorkingDays > 0 ? (presentDays / totalWorkingDays) * 100 : 0,
        absentPercentage:
          totalWorkingDays > 0 ? (absentDays / totalWorkingDays) * 100 : 0,
      });
    } catch (e) {
      console.error("Failed to load attendance data:", e);
      setErrorMsg("Failed to load attendance data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentData();
  }, [studentId]);

  useEffect(() => {
    if (startDate && endDate) {
      fetchAttendanceData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, page, limit, startDate, endDate]);

  const exportToExcel = async () => {
    if (!student) return;

    setExportLoading(true);
    try {
      // Fetch all attendance data without pagination
      const res = await api.getStudentAttendance(studentId, {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page: 1,
        limit: 10000, // Large limit to get all data
      });

      const data = res.data?.data;
      const allRecords = data?.attendance || [];

      // Create Excel content with student details at top
      const studentInfo = [
        ["Student Attendance Report"],
        [""],
        ["Student Information:"],
        ["Name", `${student.firstName} ${student.lastName}`],
        ["Student ID", student.studentId],
        ["Class", student.class],
        ["Division", student.division],
        ["Roll Number", student.rollNumber],
        ["Email", student.email],
        ["Phone", student.phone],
        [""],
        ["Report Period:"],
        ["Start Date", startDate],
        ["End Date", endDate],
        ["Total Working Days", attendanceStats.totalWorkingDays],
        ["Present Days", attendanceStats.presentDays],
        ["Present %", `${attendanceStats.presentPercentage.toFixed(2)}%`],
        ["Absent Days", attendanceStats.absentDays],
        ["Absent %", `${attendanceStats.absentPercentage.toFixed(2)}%`],
        [""],
        ["Attendance Records:"],
        [
          "Date",
          "Status",
          "Entry Time",
          "Exit Time",
          "Confidence",
          "Camera ID",
          "Location",
        ],
      ];

      const recordsData = allRecords.map((record) => [
        formatDate(record.date),
        record.status,
        record.entryTime ? formatTime(record.entryTime) : "-",
        record.exitTime ? formatTime(record.exitTime) : "-",
        `${(record.confidence * 100).toFixed(1)}%`,
        record.cameraId,
        record.location || "-",
      ]);

      const csvContent = [
        ...studentInfo.map((row) => row.join(",")),
        ...recordsData.map((row) => row.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");

      // Create and download file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);

      // Generate filename
      const now = new Date();
      const dateStr = now.toISOString().split("T")[0];
      const rangeStr =
        dateRange === "custom"
          ? `_${startDate}_to_${endDate}`
          : `_${dateRange}`;
      link.setAttribute(
        "download",
        `${student.studentId}_attendance${rangeStr}_${dateStr}.csv`
      );

      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Failed to export attendance data:", error);
      setErrorMsg("Failed to export attendance data");
    } finally {
      setExportLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present":
        return <Badge className="bg-green-100 text-green-800">Present</Badge>;
      case "late":
        return <Badge className="bg-yellow-100 text-yellow-800">Late</Badge>;
      case "absent":
        return <Badge className="bg-red-100 text-red-800">Absent</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-green-600";
    if (confidence >= 0.6) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.back()}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div>
          <p className="text-muted-foreground">
            Detailed attendance records for individual student
          </p>
        </div>
      </div>

      {/* Student Info Card */}
      {student && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Student Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded overflow-hidden bg-muted">
                <img
                  src={getPicUrl((student.photos && student.photos[0]) || "")}
                  alt=""
                  className="w-16 h-16 object-cover"
                />
              </div>
              <div className="flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {student.firstName} {student.lastName}
                    </h3>
                    <p className="text-muted-foreground">
                      ID: {student.studentId}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p>
                      <span className="font-medium">Class:</span>{" "}
                      {student.class}
                    </p>
                    <p>
                      <span className="font-medium">Division:</span>{" "}
                      {student.division}
                    </p>
                    <p>
                      <span className="font-medium">Roll Number:</span>{" "}
                      {student.rollNumber}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p>
                      <span className="font-medium">Email:</span>{" "}
                      {student.email}
                    </p>
                    <p>
                      <span className="font-medium">Phone:</span>{" "}
                      {student.phone}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p>
                      <span className="font-medium">Status:</span>
                      <Badge
                        variant={student.isActive ? "default" : "secondary"}
                        className={`ml-2 ${
                          student.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {student.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </p>
                    {student.lastSeen && (
                      <p>
                        <span className="font-medium">Last Seen:</span>{" "}
                        {formatDate(student.lastSeen)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attendance Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Attendance Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {attendanceStats.totalWorkingDays}
              </div>
              <div className="text-sm text-muted-foreground">Working Days</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {attendanceStats.presentDays}
              </div>
              <div className="text-sm text-muted-foreground">Present Days</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {attendanceStats.presentPercentage.toFixed(1)}%
              </div>
              <div className="text-sm text-muted-foreground">Present %</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {attendanceStats.absentDays}
              </div>
              <div className="text-sm text-muted-foreground">Absent Days</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {attendanceStats.absentPercentage.toFixed(1)}%
              </div>
              <div className="text-sm text-muted-foreground">Absent %</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Date Range Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Attendance Records
            </div>
            <Button
              className="flex items-center gap-2"
              onClick={exportToExcel}
              disabled={exportLoading}
            >
              {exportLoading ? (
                <FileSpreadsheet className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {exportLoading ? "Exporting..." : "Export"}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-48">
              <select
                className="h-9 w-full px-3 border rounded-md bg-background text-sm"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
              >
                <option value="current-month">Current Month</option>
                <option value="last-month">Last Month</option>
                <option value="last-3-months">Last 3 Months</option>
                <option value="last-6-months">Last 6 Months</option>
                <option value="current-year">Current Year</option>
                <option value="last-year">Last Year</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
            {dateRange === "custom" && (
              <>
                <div className="w-40">
                  <Input
                    type="date"
                    placeholder="Start Date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="[&::-webkit-calendar-picker-indicator]:invert"
                  />
                </div>
                <div className="w-40">
                  <Input
                    type="date"
                    placeholder="End Date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="[&::-webkit-calendar-picker-indicator]:invert"
                  />
                </div>
              </>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setPage(1);
                fetchAttendanceData();
              }}
            >
              Apply Filter
            </Button>
          </div>

          {/* Attendance Records Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              {attendanceRecords.length ? (
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-2 pr-2">Date</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2 pr-2">Entry Time</th>
                    <th className="py-2 pr-2">Exit Time</th>
                    <th className="py-2 pr-2">Confidence</th>
                    <th className="py-2 pr-2">Camera ID</th>
                  </tr>
                </thead>
              ) : null}

              <tbody>
                {attendanceRecords.map((record) => (
                  <tr key={record._id} className="border-t">
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {formatDate(record.date)}
                      </div>
                    </td>
                    <td className="py-2 pr-2">
                      {getStatusBadge(record.status)}
                    </td>
                    <td className="py-2 pr-2">
                      {record.entryTime ? (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {formatTime(record.entryTime)}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      {record.exitTime ? (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {formatTime(record.exitTime)}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      <span
                        className={`font-medium ${getConfidenceColor(
                          record.confidence
                        )}`}
                      >
                        {(record.confidence * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2 pr-2">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {record.cameraId}
                      </code>
                    </td>
                  </tr>
                ))}
                {!attendanceRecords?.length && !loading && (
                  <tr>
                    <td colSpan={8} className="py-6 text-center">
                      <div className="flex flex-col items-center space-y-3">
                        <Calendar className="h-12 w-12 text-muted-foreground" />
                        <div className="text-muted-foreground">
                          <p className="text-lg font-medium">
                            No attendance records found
                          </p>
                          <p className="text-sm">
                            Try adjusting your date range
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {attendanceRecords.length ? (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Page {page} of {Math.max(1, Math.ceil(total / limit))}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  disabled={page >= Math.ceil(total / limit)}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
