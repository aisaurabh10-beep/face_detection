"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { getPicUrl } from "@/lib/helper";
import { useSocket } from "@/lib/socket";
import {
  User,
  Trash2,
  Grid3x3,
  List,
  Check,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { api, Student } from "@/lib/api";
import { cn } from "@/lib/utils";

interface KnownDetection {
  kind: "known";
  id: string; // student id (studentId)
  name: string;
  className?: string;
  division?: string;
  rollNumber?: string;
  photos?: string[];
  cameraId?: string;
  time: string; // ISO
  confidence?: number;
  studentId?: string; // explicit studentId field
}

interface UnknownDetection {
  kind: "unknown";
  id: string; // unknown face id
  photos?: string[];
  cameraId?: string;
  time: string; // ISO
  confidence?: number;
  studentId?: string;
}

type Detection = KnownDetection | UnknownDetection;

const STORAGE_KEY = "all_detections";

export function AllDetectionsCard() {
  const { on, off } = useSocket();
  const [detections, setDetections] = useState<Detection[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Load detections from session storage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setDetections(Array.isArray(parsed) ? parsed : []);
        }
      } catch (error) {
        console.error("Error loading detections from session storage:", error);
      }
    }
  }, []);

  // Save detections to session storage whenever they change
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(detections));
      } catch (error) {
        console.error("Error saving detections to session storage:", error);
      }
    }
  }, [detections]);

  // Fetch all students when grid view is selected
  useEffect(() => {
    if (viewMode === "grid") {
      const fetchAllStudents = async () => {
        setLoadingStudents(true);
        try {
          const res = await api.getStudents({ limit: 1000 });
          const data = res.data?.data;
          setStudents(data?.students || []);
        } catch (error) {
          console.error("Error fetching students:", error);
          setStudents([]);
        } finally {
          setLoadingStudents(false);
        }
      };
      fetchAllStudents();
    }
  }, [viewMode]);

  useEffect(() => {
    const handleAttendance = (data: any) => {
      console.log("handle socket attendance", data);
      // { attendance, student, message }
      const now = new Date().toISOString();
      const studentId =
        data?.student?.studentId || data?.attendance?.studentId || "";
      const det: KnownDetection = {
        kind: "known",
        id: studentId,
        name:
          `${data?.student?.firstName ?? ""} ${
            data?.student?.lastName ?? ""
          }`.trim() || "Student",
        className: data?.student?.class,
        division: data?.student?.division,
        rollNumber: data?.student?.rollNumber,
        photos: data?.student?.photos,
        cameraId: data?.attendance?.cameraId,
        time: now,
        confidence: data?.attendance?.confidence,
        studentId: studentId,
      };
      setDetections((prev) => [det, ...prev]);
    };

    const handleUnknown = (data: any) => {
      // { unknownFace, message }
      const det: UnknownDetection = {
        kind: "unknown",
        id: data?.unknownFace?._id || "",
        photos: data?.unknownFace?.photos,
        cameraId: data?.unknownFace?.cameraId,
        time: data?.unknownFace?.timestamp || new Date().toISOString(),
        confidence: data?.unknownFace?.confidence,
      };
      setDetections((prev) => [det, ...prev]);
    };

    on("attendance_marked", handleAttendance as any);
    on("unknown_face_detected", handleUnknown as any);

    return () => {
      off("attendance_marked", handleAttendance as any);
      off("unknown_face_detected", handleUnknown as any);
    };
  }, [on, off]);

  const clearAllDetections = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(STORAGE_KEY);
      setDetections([]);
    }
  };

  // Check if a student is detected (present)
  const isStudentDetected = (studentId: string): boolean => {
    return detections.some(
      (det) => det.studentId === studentId || det.id === studentId
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
            All Detections ({detections.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            {detections.length > 0 && (
              <button
                onClick={clearAllDetections}
                className="text-xs text-red-400 hover:text-red-300 underline flex items-center gap-1 transition-colors mr-2"
              >
                <Trash2 className="h-3 w-3" />
                Clear All
              </button>
            )}
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
        {viewMode === "grid" ? (
          // Grid View
          loadingStudents ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">Loading students...</p>
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
                <User className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-sm text-gray-400">No students found</p>
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto">
              <div
                className={cn(
                  "grid gap-3 p-1",
                  isExpanded ? "grid-cols-4" : "grid-cols-3"
                )}
              >
                {students.map((student) => {
                  const isDetected = isStudentDetected(student.studentId);
                  return (
                    <div
                      key={student._id}
                      className={`relative rounded-lg overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900 border-2 transition-all ${
                        isDetected
                          ? "border-green-500 shadow-lg shadow-green-500/20"
                          : "border-gray-700"
                      }`}
                    >
                      {/* Student Image */}
                      <div className="aspect-square relative">
                        {student.photos?.[0] ? (
                          <Image
                            src={getPicUrl(student.photos[0])}
                            alt={`${student.firstName} ${student.lastName}`}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <User className="h-8 w-8 text-gray-400" />
                          </div>
                        )}
                        {/* Checkmark overlay for detected students */}
                        {isDetected && (
                          <div className="absolute top-1 right-1 bg-green-500 rounded-full p-1 shadow-lg">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </div>
                      {/* Student Info */}
                      <div className="p-2 bg-gray-900/90">
                        <p className="text-xs font-semibold text-white truncate">
                          {student.firstName} {student.lastName}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        ) : detections.length === 0 ? (
          // List View - Empty State
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
              <User className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-sm text-gray-400">No detections yet</p>
          </div>
        ) : (
          // List View - Detections
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {detections.map((detection, index) => (
              <div
                key={`${detection.id}-${detection.time}-${index}`}
                className="bg-gray-900 rounded-lg p-4  border-gray-700 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {/* Profile Image */}
                  <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900 flex-shrink-0 border border-gray-700">
                    {detection.photos?.[0] ? (
                      <Image
                        src={getPicUrl(detection.photos[0])}
                        alt={
                          detection.kind === "known"
                            ? detection.name
                            : "Unknown"
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

                  {/* Details - Image, Name, Roll, Student ID, Class, Division */}
                  <div className="flex-1 min-w-0">
                    {detection.kind === "known" ? (
                      <>
                        <h3 className="text-base font-semibold text-white truncate">
                          {detection.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-gray-400">
                          {detection.rollNumber && (
                            <span>Roll: {detection.rollNumber}</span>
                          )}
                          {(detection.studentId || detection.id) && (
                            <span>
                              ID: {detection.studentId || detection.id}
                            </span>
                          )}
                          {detection.className && (
                            <span>Class: {detection.className}</span>
                          )}
                          {detection.division && (
                            <span>Div: {detection.division}</span>
                          )}
                          {detection.time && (
                            <span>
                              Time:{" "}
                              {new Date(detection.time).toLocaleDateString()}{" "}
                              {new Date(detection.time).toLocaleTimeString()}
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <h3 className="text-base font-semibold text-red-400">
                          Unknown Face
                        </h3>
                        <p className="text-sm text-gray-400 mt-1">
                          ID: {detection.id}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return isExpanded ? (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm overflow-auto p-6">
      {card}
    </div>
  ) : (
    card
  );
}

