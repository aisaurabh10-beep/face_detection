"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import Link from "next/link";
import { getPicUrl } from "@/lib/helper";
import { useSocket } from "@/lib/socket";
import { Clock, Camera, User, AlertTriangle } from "lucide-react";

interface KnownDetection {
  kind: "known";
  id: string; // student id
  name: string;
  className?: string;
  division?: string;
  rollNumber?: string;
  photos?: string[];
  cameraId?: string;
  time: string; // ISO
  confidence?: number;
}

interface UnknownDetection {
  kind: "unknown";
  id: string; // unknown face id
  photos?: string[];
  cameraId?: string;
  time: string; // ISO
  confidence?: number;
}

type LastDetection = KnownDetection | UnknownDetection | null;

export function LastDetectionCard({ showOverlay }: { showOverlay: boolean }) {
  const { on, off } = useSocket();
  const [lastDetection, setLastDetection] = useState<LastDetection>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    const handleAttendance = (data: any) => {
      console.log("handle socket attendance", data);
      // { attendance, student, message }
      const now = new Date().toISOString();
      const det: KnownDetection = {
        kind: "known",
        id: data?.student?._id || data?.attendance?.studentId || "",
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
      };
      setLastDetection(det);
      setVisible(true);
      clearTimer();
      timerRef.current = window.setTimeout(() => setVisible(false), 2500);
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
      setLastDetection(det);
      setVisible(true);
      clearTimer();
      timerRef.current = window.setTimeout(() => setVisible(false), 2500);
    };

    on("attendance_marked", handleAttendance as any);
    on("unknown_face_detected", handleUnknown as any);

    return () => {
      off("attendance_marked", handleAttendance as any);
      off("unknown_face_detected", handleUnknown as any);
      clearTimer();
    };
  }, [on, off]);

  const headerTitle = useMemo(() => {
    if (!lastDetection) return "Last Detection";
    return lastDetection.kind === "known" ? "Last Entry" : "Unknown Face";
  }, [lastDetection]);

  console.log("lastDetection===", lastDetection);

  return showOverlay ? (
    <Card className="mt-5 relative overflow-hidden bg-black/90 backdrop-blur-sm border border-gray-700 shadow-2xl max-w-sm mx-auto">
      <CardHeader className="text-center pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold text-white">
            {headerTitle}
          </CardTitle>
          {lastDetection?.kind === "known" ? (
            <Badge className="bg-green-600 text-white border-green-500 px-3 py-1">
              Present
            </Badge>
          ) : lastDetection?.kind === "unknown" ? (
            <Badge className="bg-red-600 text-white border-red-500 px-3 py-1">
              Unknown
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {!lastDetection ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
              <User className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-sm text-gray-400">Waiting for detections…</p>
          </div>
        ) : (
          <div
            className={`transition-all duration-500 ${
              visible ? "opacity-100 scale-100" : "opacity-0 scale-95"
            }`}
          >
            {/* Large Image at Top */}
            <div className="text-center mb-6">
              <div className="relative w-32 h-32 mx-auto rounded-2xl overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center shadow-lg border border-gray-700">
                {lastDetection.photos || (lastDetection as any).photos?.[0] ? (
                  <Image
                    src={getPicUrl(lastDetection.photos[0])}
                    alt="Face"
                    width={128}
                    height={128}
                    className="object-cover w-full h-full"
                    unoptimized
                  />
                ) : (
                  <User className="h-12 w-12 text-gray-400" />
                )}
                {/* Confidence indicator */}
                {typeof lastDetection.confidence === "number" && (
                  <div className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full font-medium border border-blue-500">
                    {Math.round(lastDetection.confidence * 100)}%
                  </div>
                )}
              </div>
            </div>

            {/* Details Below Image */}
            <div className="space-y-4">
              {lastDetection.kind === "known" ? (
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-bold text-white">
                    {lastDetection.name}
                  </h3>
                  <div className="flex flex-wrap justify-center gap-2 text-sm">
                    {lastDetection.className && (
                      <span className="bg-blue-900 text-blue-300 px-3 py-1 rounded-full border border-blue-700">
                        Class {lastDetection.className}
                      </span>
                    )}
                    {lastDetection.rollNumber && (
                      <span className="bg-purple-900 text-purple-300 px-3 py-1 rounded-full border border-purple-700">
                        Roll {lastDetection.rollNumber}
                      </span>
                    )}
                    {lastDetection.division && (
                      <span className="bg-green-900 text-green-300 px-3 py-1 rounded-full border border-green-700">
                        {lastDetection.division}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="flex items-center justify-center text-lg font-semibold text-red-400 mb-2">
                    <AlertTriangle className="h-5 w-5 mr-2" />
                    Unknown Face Detected
                  </div>
                  <p className="text-sm text-gray-400">
                    Face not recognized in the system
                  </p>
                </div>
              )}

              {/* Metadata */}
              <div className="bg-gray-900 rounded-lg p-4 space-y-2 border border-gray-700">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-gray-400">
                    <Clock className="h-4 w-4" />
                    Time
                  </span>
                  <span className="font-medium text-white">
                    {new Date(lastDetection.time).toLocaleTimeString()}
                  </span>
                </div>
                {lastDetection.cameraId && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-gray-400">
                      <Camera className="h-4 w-4" />
                      Camera
                    </span>
                    <span className="font-medium text-white">
                      {lastDetection.cameraId}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Button */}
              {lastDetection.kind === "known" && (
                <div className="text-center">
                  <Link href={`/students`}>
                    <span className="inline-flex items-center px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors cursor-pointer shadow-md border border-blue-500">
                      View Student Details
                    </span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  ) : null;
}
