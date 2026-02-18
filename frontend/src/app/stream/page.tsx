"use client";

import StreamPlayer from "@/components/camera/StreamPlayer";
import { CAMERAS, streamSteps } from "@/lib/constants";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useTour } from "@/hooks/useTour";

function StreamContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { startTour } = useTour();
  const expand = searchParams.get("expand") === "true";

  useEffect(() => {
    const tourDone = sessionStorage.getItem("tour_stream_completed");
    if (!tourDone && !expand) {
      setTimeout(() => startTour(streamSteps), 1000);
      sessionStorage.setItem("tour_stream_completed", "true");
    }
  }, [startTour, expand]);

  useEffect(() => {
    if (!expand) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        router.push("/stream");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expand, router]);

  const player = (
    <div id="tour-stream-player" className="w-full h-full">
      <StreamPlayer cameras={CAMERAS} />
    </div>
  );

  if (expand) {
    return <div className="fixed inset-0 z-50 bg-black">{player}</div>;
  }

  return <div className="h-full">{player}</div>;
}

export default function CamerasPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <StreamContent />
    </Suspense>
  );
}
