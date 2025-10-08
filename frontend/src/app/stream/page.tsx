"use client";

import StreamPlayer from "@/components/camera/StreamPlayer";
import { CAMERAS } from "@/lib/constants";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function StreamContent() {
  const searchParams = useSearchParams();
  const expand = searchParams.get("expand") === "true";

  const content = <StreamPlayer cameras={CAMERAS} />;
  if (expand) return content;

  return content;
}

export default function CamerasPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <StreamContent />
    </Suspense>
  );
}
