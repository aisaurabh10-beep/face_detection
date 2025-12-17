"use client";

import StreamPlayer from "@/components/camera/StreamPlayer";
import { AllDetectionsCard } from "@/components/dashboard/all-detections";
import { AttendanceChart } from "@/components/dashboard/attendance-chart";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { DivisionAttendanceChart } from "@/components/dashboard/division-attendance-chart";
import { CAMERAS } from "@/lib/constants";
import { Suspense } from "react";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <DashboardStats />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Suspense fallback={<div>Loading camera...</div>}>
            <StreamPlayer cameras={CAMERAS} />
          </Suspense>
        </div>

        <div className="space-y-6"><AllDetectionsCard /></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AttendanceChart />
        <DivisionAttendanceChart />
      </div>
    </div>
  );
}

