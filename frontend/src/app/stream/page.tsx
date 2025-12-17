"use client";

import StreamPlayer from "@/components/camera/StreamPlayer";
import { CAMERAS } from "@/lib/constants";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

function StreamContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const expand = searchParams.get("expand") === "true";

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
    <div className="w-full h-full">
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
