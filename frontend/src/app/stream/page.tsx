"use client";

import StreamPlayer from "@/components/camera/StreamPlayer";
import { MainLayout } from "@/components/layout/main-layout";
import { CAMERAS } from "@/lib/constants";
import { useSearchParams } from "next/navigation";

export default function CamerasPage() {
  const searchParams = useSearchParams();
  const expand = searchParams.get("expand") === "true";

  const content = <StreamPlayer cameras={CAMERAS} />;
  if (expand) return content;

  return <MainLayout>{content}</MainLayout>;
}
