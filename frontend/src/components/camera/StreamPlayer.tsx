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
  Settings,
  Expand,
  Minimize2,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { STORAGE_CAMERA_KEY, STORAGE_KEY } from "@/lib/constants";

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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isExpanded =
    pathname === "/stream" && searchParams?.get("expand") === "true";

  // load persisted preferences
  useEffect(() => {
    try {
      const sourceType = window.localStorage.getItem(STORAGE_KEY);
      if (sourceType === "device" || sourceType === "actual") {
        console.log("sourceType", sourceType);
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

  // Handle detection events to show overlay and pause stream for 2s
  useEffect(() => {
    const show = () => {
      setShowOverlay(true);
      // if (videoRef.current && !videoRef.current.paused) {
      //   try {
      //     videoRef.current.pause();
      //   } catch {}
      // }
      if (stopOverlayTimer.current)
        window.clearTimeout(stopOverlayTimer.current);
      stopOverlayTimer.current = window.setTimeout(() => {
        setShowOverlay(false);
        // if (videoRef.current && isStreaming) {
        //   try {
        //     videoRef.current.play();
        //   } catch {}
        // }
      }, 2000);
    };

    const handleAttendance = () => show();
    const handleUnknown = () => show();

    on("attendance_marked", handleAttendance as any);
    on("unknown_face_detected", handleUnknown as any);

    return () => {
      off("attendance_marked", handleAttendance as any);
      off("unknown_face_detected", handleUnknown as any);
      if (stopOverlayTimer.current)
        window.clearTimeout(stopOverlayTimer.current);
    };
  }, [on, off, isStreaming]);

  const start = useCallback(async () => {
    setIsStreaming(true);
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
      }
    } else if (source === "actual") {
      if (!selectedCameraId && cameras.length > 0) {
        const firstId = cameras[0].id;
        setSelectedCameraId(firstId);
        try {
          window.localStorage.setItem(STORAGE_CAMERA_KEY, firstId);
        } catch {}
      }
      // For iframe sources, rendering is controlled by state; nothing else to start
    }
  }, [source, selectedCameraId, cameras]);

  const stop = useCallback(() => {
    setIsStreaming(false);
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
    // small delay to release tracks
    const t = setTimeout(() => start(), 50);
    return () => clearTimeout(t);
  }, [source]);

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
          {/* Device stream */}
          {source === "device" ? (
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover bg-black"
              playsInline
              muted
              autoPlay
            />
          ) : // Actual stream - for now render iframe to provided streaming url
          selectedCamera?.url ? (
            <iframe
              src={selectedCamera.url}
              className="absolute inset-0 w-full h-full"
              allow="autoplay; camera; microphone"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
              <div className="text-center text-white">
                <CameraOff className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No camera selected</p>
              </div>
            </div>
          )}

          {/* Overlay LastDetectionCard */}
          {showOverlay && (
            <div className="absolute top-3 left-3 right-3">
              <LastDetectionCard />
            </div>
          )}
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
