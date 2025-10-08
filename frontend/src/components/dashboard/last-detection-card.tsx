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
  photo?: string;
  photos?: string[];
  cameraId?: string;
  time: string; // ISO
  confidence?: number;
}

interface UnknownDetection {
  kind: "unknown";
  id: string; // unknown face id
  photo?: string;
  cameraId?: string;
  time: string; // ISO
  confidence?: number;
}

type LastDetection = KnownDetection | UnknownDetection | null;

export function LastDetectionCard() {
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
        photo: data?.student?.photo,
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
        photo: data?.unknownFace?.photo,
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

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {headerTitle}
        </CardTitle>
        {lastDetection?.kind === "known" ? (
          <Badge variant="success" className="text-xs">
            Present
          </Badge>
        ) : lastDetection?.kind === "unknown" ? (
          <Badge variant="destructive" className="text-xs">
            Unknown
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent>
        {!lastDetection ? (
          <div className="text-sm text-muted-foreground">
            Waiting for detections…
          </div>
        ) : (
          <div
            className={`transition-opacity duration-500 ${
              visible ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                {lastDetection.photo || (lastDetection as any).photos?.[0] ? (
                  <Image
                    src={getPicUrl(
                      lastDetection.photo || (lastDetection as any).photos?.[0]
                    )}
                    alt="Face"
                    width={64}
                    height={64}
                    className="object-cover w-16 h-16"
                    unoptimized
                  />
                ) : (
                  <User className="h-6 w-6 text-muted-foreground" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                {lastDetection.kind === "known" ? (
                  <div className="space-y-1">
                    <div className="text-base font-semibold truncate">
                      {lastDetection.name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {lastDetection.className
                        ? `Class ${lastDetection.className}`
                        : ""}
                      {lastDetection.rollNumber
                        ? ` • Roll ${lastDetection.rollNumber}`
                        : ""}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center text-sm font-medium">
                    <AlertTriangle className="h-4 w-4 text-yellow-500 mr-2" />{" "}
                    Unknown Face Detected
                  </div>
                )}

                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  {lastDetection.cameraId && (
                    <span className="flex items-center gap-1">
                      <Camera className="h-3 w-3" /> {lastDetection.cameraId}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />{" "}
                    {new Date(lastDetection.time).toLocaleTimeString()}
                  </span>
                  {typeof lastDetection.confidence === "number" && (
                    <span>
                      {Math.round(lastDetection.confidence * 100)}% conf
                    </span>
                  )}
                </div>

                {lastDetection.kind === "known" ? (
                  <div className="mt-3">
                    <Link href={`/students`}>
                      <span className="inline-flex items-center text-xs px-3 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer">
                        Open student
                      </span>
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
