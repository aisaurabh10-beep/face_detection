"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSocket } from "@/lib/socket";
import config from "@/config/config";
import { LastDetectionCard } from "@/components/dashboard/last-detection-card";
import {
  Camera,
  CameraOff,
  Play,
  Square,
  Expand,
  Minimize2,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { STORAGE_CAMERA_KEY, STORAGE_KEY } from "@/lib/constants";
import RTSPtoWebClient from "@/lib/RTSPtoWebClient";
import { api } from "@/lib/api";

type StreamSource = "device" | "actual";

export interface ActualCamera {
  id: string;
  name: string;
  url: string;
}

interface StreamPlayerProps {
  title?: string;
  cameras?: ActualCamera[];
  className?: string;
}

export function StreamPlayer({
  title = "Live Camera Feed",
  cameras = [],
  className,
}: StreamPlayerProps) {
  const { on, off } = useSocket();
  const [isStreaming, setIsStreaming] = useState(false);
  const [source, setSource] = useState<StreamSource>(config.defaultStream);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stopOverlayTimer = useRef<number | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [streamError, setStreamError] = useState<string>("");
  const streamInitializedRef = useRef(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testMessage, setTestMessage] = useState<string>("");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isExpanded =
    pathname === "/stream" && searchParams?.get("expand") === "true";

  // load persisted preferences
  useEffect(() => {
    try {
      const sourceType = window.localStorage.getItem(STORAGE_KEY);
      if (sourceType === "device" || sourceType === "actual") {
        setSource(sourceType);
      }
      const savedCam = window.localStorage.getItem(STORAGE_CAMERA_KEY);
      if (savedCam) setSelectedCameraId(savedCam);
    } catch {}
  }, []);

  const selectedCamera = useMemo(() => {
    if (!selectedCameraId) return cameras[0] || null;
    return cameras.find((c) => c.id === selectedCameraId) || cameras[0] || null;
  }, [cameras, selectedCameraId]);

  // useEffect(() => {
  //   const show = () => {
  //     console.log("show overlay");
  //     setShowOverlay(true);
  //     // if (videoRef.current && !videoRef.current.paused) {
  //     //   try {
  //     //     videoRef.current.pause();
  //     //   } catch {}
  //     // }
  //     // if (stopOverlayTimer.current) {
  //     //   window.clearTimeout(stopOverlayTimer.current);
  //     // }

  //     stopOverlayTimer.current = window.setTimeout(() => {
  //       console.log("hide overlay");
  //       setShowOverlay(false);
  //       // if (videoRef.current && isStreaming) {
  //       //   try {
  //       //     videoRef.current.play();
  //       //   } catch {}
  //       // }
  //     }, 2000);
  //   };

  //   const handleAttendance = () => show();
  //   const handleUnknown = () => show();

  //   on("attendance_marked", handleAttendance as any);
  //   on("unknown_face_detected", handleUnknown as any);

  //   return () => {
  //     off("attendance_marked", handleAttendance as any);
  //     off("unknown_face_detected", handleUnknown as any);
  //     if (stopOverlayTimer.current) {
  //       window.clearTimeout(stopOverlayTimer.current);
  //       stopOverlayTimer.current = null;
  //     }
  //   };
  // }, [on, off]);

  useEffect(() => {
    const show = () => {
      console.log("show overlay");
      setShowOverlay(true);

      if (stopOverlayTimer.current) {
        clearTimeout(stopOverlayTimer.current);
      }

      stopOverlayTimer.current = window.setTimeout(() => {
        console.log("hide overlay");
        setShowOverlay(false);
        stopOverlayTimer.current = null;
      }, 5000);
    };

    const handleAttendance = () => show();
    const handleUnknown = () => show();

    on("attendance_marked", handleAttendance as any);
    on("unknown_face_detected", handleUnknown as any);

    return () => {
      off("attendance_marked", handleAttendance as any);
      off("unknown_face_detected", handleUnknown as any);
      if (stopOverlayTimer.current) {
        clearTimeout(stopOverlayTimer.current);
        stopOverlayTimer.current = null;
      }
    };
  }, []); // no deps

  const start = useCallback(async () => {
    setIsStreaming(true);
    setStreamError("");

    if (source === "device" && videoRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        videoRef.current.srcObject = stream as any;
        await videoRef.current.play();
      } catch (e) {
        console.error(e);
        setIsStreaming(false);
        setStreamError("Failed to access device camera");
      }
    } else if (source === "actual" && selectedCameraId && videoRef.current) {
      if (!streamInitializedRef.current) {
        streamInitializedRef.current = true;

        RTSPtoWebClient.setupStream(
          selectedCameraId,
          videoRef.current,
          () => {
            console.log("WebRTC stream started successfully!");
            setIsStreaming(true);
          },
          (error) => {
            console.error("WebRTC stream setup error:", error);
            setStreamError(`WebRTC stream error: ${error.message}`);
            setIsStreaming(false);
            streamInitializedRef.current = false;
          }
        );
      }
    } else if (source === "actual" && !selectedCameraId && cameras.length > 0) {
      const firstId = cameras[0].id;
      setSelectedCameraId(firstId);
      try {
        window.localStorage.setItem(STORAGE_CAMERA_KEY, firstId);
      } catch {}
    }
  }, [source, selectedCameraId, cameras]);

  const handleTestAttendance = useCallback(async () => {
    setTestLoading(true);
    setTestMessage("");

    try {
      // Test data for attendance marking
      const testData = {
        studentId: "68e6972728e7a1f953567733", // Example ObjectId - you may need to replace with actual student ID
        cameraId: "camera1",
        confidence: 0.95,
      };

      const response = await api.markAttendance(testData);

      setTestMessage(`✅ Success: ${response.data.message}`);
      console.log("Test attendance marked:", response.data);
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to mark test attendance";
      setTestMessage(`❌ Error: ${errorMsg}`);
      console.error("Test attendance error:", error);
    } finally {
      setTestLoading(false);
      // Clear message after 5 seconds
      setTimeout(() => setTestMessage(""), 5000);
    }
  }, [selectedCameraId]);

  const stop = useCallback(() => {
    setIsStreaming(false);
    streamInitializedRef.current = false;
    setStreamError("");

    if (videoRef.current) {
      try {
        const mediaStream = videoRef.current.srcObject as MediaStream | null;
        if (mediaStream) {
          mediaStream.getTracks().forEach((t) => t.stop());
        }
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      } catch {}
    }
  }, []);

  // switch source should stop any ongoing device stream
  useEffect(() => {
    if (!isStreaming) return;
    // restart appropriately on source change
    stop();
    setIsStreaming(false);
    // small delay to release tracks
    const t = setTimeout(() => {
      // if (source !== "actual") {
      start();
      setIsStreaming(true);
      // }
    }, 50);
    return () => clearTimeout(t);
  }, [source, selectedCameraId]);

  return (
    <Card
      className={cn(
        "relative overflow-hidden",
        isExpanded ? "h-[100dvh]" : "",
        className
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="flex items-center space-x-2">
            <Camera className="h-5 w-5" />
            <span>{title}</span>
            {isStreaming && (
              <Badge variant="destructive" className="animate-pulse">
                <div className="w-2 h-2 bg-white rounded-full mr-1" />
                LIVE
              </Badge>
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time face detection and recognition
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <select
            className="h-9 px-3 border rounded-md bg-background text-sm"
            value={source}
            onChange={(e) => {
              const next = e.target.value as StreamSource;
              setSource(next);
              try {
                window.localStorage.setItem(STORAGE_KEY, next);
              } catch {}
            }}
          >
            <option value="device">Device camera</option>
            <option value="actual">Actual camera</option>
          </select>
          {source === "actual" && (
            <select
              className="h-9 px-3 border rounded-md bg-background text-sm"
              value={selectedCamera?.id || ""}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedCameraId(id);
                try {
                  window.localStorage.setItem(STORAGE_CAMERA_KEY, id);
                } catch {}
              }}
            >
              <option value="">Select Camera</option>
              {cameras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={isStreaming ? stop : start}
          >
            {isStreaming ? (
              <>
                <Square className="h-4 w-4 mr-2" /> Stop
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" /> Start
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestAttendance}
            disabled={testLoading}
          >
            {testLoading ? "Testing..." : "Test"}
          </Button>
          {pathname === "/stream" ? (
            isExpanded ? (
              <Link href="/stream">
                <Button variant="outline" size="sm" aria-label="Exit full view">
                  <Minimize2 className="h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <Link href="/stream?expand=true">
                <Button variant="outline" size="sm" aria-label="Expand">
                  <Expand className="h-4 w-4" />
                </Button>
              </Link>
            )
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div
          className={cn(
            "relative bg-black rounded-lg overflow-hidden",
            isExpanded ? "h-[calc(100dvh-88px)]" : "aspect-video"
          )}
        >
          {/* Stream error display */}
          {streamError && (
            <div className="absolute top-3 left-3 right-3 z-10">
              <div className="bg-red-100 border border-red-300 text-red-500 rounded-md p-3">
                <p className="text-sm font-medium">Stream Error</p>
                <p className="text-xs mt-1">{streamError}</p>
              </div>
            </div>
          )}

          {/* Test message display */}
          {testMessage && (
            <div className="absolute top-3 right-3 z-10">
              <div
                className={`rounded-md p-3 max-w-sm ${
                  testMessage.includes("✅")
                    ? "bg-green-100 border border-green-300 text-green-500"
                    : "bg-red-100 border border-red-300 text-red-500"
                }`}
              >
                <p className="text-sm font-medium">
                  {testMessage.includes("✅") ? "Test Success" : "Test Error"}
                </p>
                <p className="text-xs mt-1">{testMessage}</p>
              </div>
            </div>
          )}

          {/* Video stream for both device and actual cameras */}
          {source === "device" || source === "actual" ? (
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover bg-black"
              playsInline
              muted
              autoPlay
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
              <div className="text-center text-white">
                <CameraOff className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No camera selected</p>
              </div>
            </div>
          )}
          <LastDetectionCard showOverlay={showOverlay} />
        </div>
        <div className="p-4 bg-muted/50 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <div className="flex items-center space-x-1">
                <div
                  className={cn(
                    "w-2 h-2 rounded-full",
                    isStreaming ? "bg-green-500" : "bg-gray-400"
                  )}
                />
                <span>{isStreaming ? "Streaming" : "Offline"}</span>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              {source === "device"
                ? "Device Camera"
                : selectedCamera?.name || "Actual Camera"}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default StreamPlayer;
