"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { MAX_LAST_DETECTIONS } from "@/lib/constants";
import { getPicUrl } from "@/lib/helper";
import { useSocket } from "@/lib/socket";
import { SocketAttendance, SocketStudent, TodayAttendance } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Grid3x3,
  List,
  Loader2,
  Maximize2,
  Minimize2,
  User,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type ViewMode = "list" | "grid";

export function AllDetectionsCard() {
  const { on, off } = useSocket();
  const [detections, setDetections] = useState<TodayAttendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedAttendance, setSelectedAttendance] =
    useState<TodayAttendance | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const todayDate = useMemo(() => new Date().toISOString().split("T")[0], []);

  const fetchTodayAttendance = async () => {
    setLoading(true);
    try {
      // Last 50 attendance records for today from backend
      const res = await api.getTodayAttendance({ limit: MAX_LAST_DETECTIONS });
      const attendanceData: any[] = Array.isArray(res.data?.data)
        ? res.data.data
        : res.data?.data?.attendance || res.data?.attendance || [];

      const transformed: TodayAttendance[] = attendanceData
        .flatMap((attendance) => {
          const det: TodayAttendance = {
            entryTime: attendance.entryTime,
            exitTime: attendance.exitTime,
            date: attendance.date,
            student: attendance.studentId,
            logs: attendance.logs,
            _id: attendance._id,
            updatedAt: attendance.updatedAt,
          };

          return [det];
        })
        .sort((a, b) => {
          const aTime = new Date(a.updatedAt || a.entryTime).getTime();
          const bTime = new Date(b.updatedAt || b.entryTime).getTime();
          return bTime - aTime;
        });

      setDetections(transformed);
    } catch (error) {
      console.error("Error fetching today's attendance:", error);
      setDetections([]);
    } finally {
      setLoading(false);
    }
  };

  // const fetchAllStudents = async () => {
  //   try {
  //     const res = await api.getStudents({
  //       page: 1,
  //       limit: 1000,
  //     });
  //     const list: Student[] = res.data?.data?.students || [];
  //     setStudents(list);
  //   } catch (error) {
  //     console.error("Error fetching students:", error);
  //     setStudents([]);
  //   }
  // };

  useEffect(() => {
    fetchTodayAttendance();
    // fetchAllStudents();
  }, []);

  // Update attendance when new attendance is marked via socket
  useEffect(() => {
    const handleAttendance = ({
      attendance,
      student,
    }: {
      attendance: SocketAttendance;
      student: SocketStudent;
    }) => {
      if (!student || !attendance) return;

      const now = new Date().toISOString();
      const score = (item: TodayAttendance) =>
        new Date(item.updatedAt || item.entryTime || item.date || 0).getTime();

      setDetections((prev) => {
        const existingIndex = prev.findIndex(
          (det) => det._id === attendance._id || det.id === attendance._id
        );

        const base = existingIndex !== -1 ? prev[existingIndex] : undefined;

        const mergedLogs = (attendance as any).logs ?? base?.logs ?? [];

        const updatedDetection: TodayAttendance = {
          _id: attendance._id || "",
          student: attendance.studentId || student || base?.student,
          entryTime: attendance.entryTime ?? base?.entryTime,
          exitTime: attendance.exitTime ?? base?.exitTime,
          date: attendance.date || base?.date || now,
          updatedAt: (attendance as any).updatedAt || base?.updatedAt || now,
          logs: mergedLogs,
        };

        const updatedList =
          existingIndex !== -1
            ? (() => {
                const copy = [...prev];
                copy[existingIndex] = updatedDetection;
                return copy;
              })()
            : [updatedDetection, ...prev];

        return updatedList
          .sort((a, b) => score(b) - score(a))
          .slice(0, MAX_LAST_DETECTIONS);
      });
    };

    on("attendance_marked", handleAttendance as any);

    return () => {
      off("attendance_marked", handleAttendance as any);
    };
  }, [on, off]);

  const openStudentDetails = (studentRecord: TodayAttendance) => {
    if (!studentRecord?._id) return;
    setDetailsOpen(true);
    setErrorMsg("");
    setSelectedAttendance(studentRecord);
  };

  const renderList = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-10 text-gray-300">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading students...
        </div>
      );
    }
    if (detections.length === 0) {
      return (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
            <User className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-sm text-gray-400">No attendance logs for today</p>
        </div>
      );
    }

    return (
      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {detections.map((detection, index) => {
          const student = detection.student;
          const photoSrc = student?.photos?.[0];

          return (
            <button
              key={`${detection._id}-${detection.time}-${index}`}
              onClick={() => openStudentDetails(detection)}
              className="w-full text-left bg-gray-900 rounded-lg p-4 hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900 flex-shrink-0 border border-gray-700">
                  {photoSrc ? (
                    <Image
                      src={getPicUrl(photoSrc)}
                      alt={
                        student
                          ? `${student.firstName || ""} ${
                              student.lastName || ""
                            }`.trim() || "Student"
                          : "Student"
                      }
                      width={64}
                      height={64}
                      className="object-cover w-full h-full"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-white truncate">
                    {student
                      ? `${student.firstName || ""} ${
                          student.lastName || ""
                        }`.trim() || "Student"
                      : "Student"}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-gray-400">
                    {student?.rollNumber && (
                      <span>Roll: {student.rollNumber}</span>
                    )}
                    {student?.class && <span>Class: {student.class}</span>}
                    {student?.division && <span>Div: {student.division}</span>}
                    {detection.time && (
                      <span>
                        Time: {new Date(detection.time).toLocaleDateString()}{" "}
                        {new Date(detection.time).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  const renderGrid = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-10 text-gray-300">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading students...
        </div>
      );
    }

    if (detections.length === 0) {
      return (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
            <User className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-sm text-gray-400">No attendance logs for today</p>
        </div>
      );
    }

    return (
      <div
        className={cn(
          "grid gap-3 max-h-[600px] overflow-y-auto",
          isExpanded
            ? "grid-cols-auto-fit-200"
            : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
        )}
        style={
          isExpanded
            ? {
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              }
            : undefined
        }
      >
        {detections.map((detection) => {
          return (
            <button
              key={detection._id}
              onClick={() => openStudentDetails(detection)}
              className={cn(
                "group relative rounded-lg border border-gray-900 bg-gray-900 text-left transition-colors hover:border-gray-600",
                isExpanded && "flex flex-col items-center"
              )}
            >
              <div
                className={cn(
                  "relative rounded-md overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-800",
                  isExpanded
                    ? "w-[200px] h-[200px] max-w-[200px] max-h-[200px] flex-shrink-0"
                    : "w-full aspect-square"
                )}
              >
                {detection.student?.photos?.[0] ? (
                  <Image
                    src={getPicUrl(detection.student?.photos[0])}
                    alt={detection.student?.firstName || "Student"}
                    width={isExpanded ? 200 : 50}
                    height={isExpanded ? 200 : 50}
                    className="object-cover w-full h-full"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User
                      className={cn(
                        isExpanded ? "h-16 w-16" : "h-8 w-8",
                        "text-gray-400"
                      )}
                    />
                  </div>
                )}
                <div className="absolute top-0 right-0 rounded-full bg-emerald-600 text-white p-1 shadow-lg">
                  <CheckCircle2
                    className={cn(isExpanded ? "h-5 w-5" : "h-4 w-4")}
                  />
                </div>
              </div>
              <p className="mt-1 text-sm font-semibold text-white truncate text-center">
                {`${detection?.student?.firstName}`}
              </p>
            </button>
          );
        })}
      </div>
    );
  };

  const renderDetailsModal = () => {
    if (!detailsOpen) return null;

    const att = selectedAttendance;
    const student = selectedAttendance?.student;

    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="relative w-full max-w-3xl bg-gray-950 border border-gray-800 rounded-xl shadow-2xl p-6">
          <button
            onClick={() => setDetailsOpen(false)}
            className="absolute top-3 right-3 text-gray-400 hover:text-white"
            aria-label="Close details"
          >
            <X className="h-5 w-5" />
          </button>

          {errorMsg ? (
            <p className="text-sm text-red-400">{errorMsg}</p>
          ) : (
            <>
              {student ? (
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
                    {student.photos?.[0] ? (
                      <Image
                        src={getPicUrl(student.photos[0])}
                        alt={student.firstName}
                        width={96}
                        height={96}
                        className="object-cover w-full h-full"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="h-10 w-10 text-gray-500" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <h3 className="text-xl font-semibold text-white">
                      {student.firstName} {student.lastName}
                    </h3>
                    <p className="text-sm text-gray-300">
                      Student ID: {student.studentId}
                    </p>
                    <p className="text-sm text-gray-400">
                      Class: {student.class} • Division: {student.division} •
                      Roll Number: {student.rollNumber}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-300">No student data found.</p>
              )}

              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-200">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span>
                    Entry Time:{" "}
                    {att?.entryTime
                      ? new Date(att.entryTime).toLocaleTimeString()
                      : "Not marked"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span>
                    Exit Time:{" "}
                    {att?.exitTime
                      ? new Date(att.exitTime).toLocaleTimeString()
                      : "Not marked"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-gray-400" />
                  <span>
                    Date:{" "}
                    {att?.date
                      ? new Date(att.date).toLocaleDateString()
                      : todayDate}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span>
                    Last Updated:{" "}
                    {att?.updatedAt
                      ? new Date(att.updatedAt).toLocaleTimeString()
                      : "Not updated"}
                  </span>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-sm font-semibold text-white mb-2">
                  Logs for today
                </p>
                {att?.logs?.length ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {att.logs.map((log) => {
                      const dt = new Date(log.timestamp);
                      const confidence = (log.confidence ?? 0) * 100;
                      const confidenceColor =
                        confidence >= 90
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                          : confidence >= 75
                          ? "bg-amber-500/10 text-amber-300 border-amber-500/40"
                          : "bg-red-500/10 text-red-300 border-red-500/40";

                      return (
                        <div
                          key={log._id || log.timestamp}
                          className="flex items-start justify-between rounded-md border border-gray-800 bg-gray-900 px-3 py-2 text-xs text-gray-200"
                        >
                          <div className="space-y-1">
                            <p className="font-medium text-gray-100">
                              {dt.toLocaleTimeString()}
                            </p>
                            <p className="text-gray-400 flex items-center gap-2">
                              <span>{log.cameraId || "Camera 1"}</span>
                              {log.location && (
                                <>
                                  <span className="text-gray-600">•</span>
                                  <span>{log.location}</span>
                                </>
                              )}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 border text-[11px] font-medium",
                              confidenceColor
                            )}
                          >
                            {confidence.toFixed(1)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">
                    No logs available for today.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const card = (
    <Card
      className={cn(
        "relative overflow-hidden bg-black/90 backdrop-blur-sm border border-gray-700 shadow-2xl",
        isExpanded && "max-w-6xl mx-auto"
      )}
    >
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold text-white ">
            Today&apos;s Attendance Logs ({detections.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1 border border-gray-700">
              <button
                onClick={() => setViewMode("list")}
                className={`p-1 rounded transition-colors ${
                  viewMode === "list"
                    ? "bg-gray-700 text-white"
                    : "text-gray-400 hover:text-gray-300"
                }`}
                title="List View"
              >
                <List className="h-3 w-3" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1 rounded transition-colors ${
                  viewMode === "grid"
                    ? "bg-gray-700 text-white"
                    : "text-gray-400 hover:text-gray-300"
                }`}
                title="Grid View"
              >
                <Grid3x3 className="h-3 w-3" />
              </button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={isExpanded ? "Collapse" : "Expand"}
              onClick={() => setIsExpanded((v) => !v)}
            >
              {isExpanded ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400">Loading attendance logs...</p>
          </div>
        ) : viewMode === "list" ? (
          renderList()
        ) : (
          renderGrid()
        )}
      </CardContent>
    </Card>
  );

  return (
    <>
      {isExpanded ? (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm overflow-auto p-6">
          {card}
        </div>
      ) : (
        card
      )}
      {renderDetailsModal()}
    </>
  );
}
