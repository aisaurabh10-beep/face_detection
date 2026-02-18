"use client";

import StreamPlayer from "@/components/camera/StreamPlayer";
import { AllDetectionsCard } from "@/components/dashboard/all-detections";
import { AttendanceChart } from "@/components/dashboard/attendance-chart";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { DivisionAttendanceChart } from "@/components/dashboard/division-attendance-chart";
import { useTour } from "@/hooks/useTour";
import { CAMERAS, dashboardSteps } from "@/lib/constants";
import { Suspense, useEffect } from "react";

export default function DashboardPage() {
  const { startTour } = useTour();

  useEffect(() => {
    const tourDone = sessionStorage.getItem("tour_completed");
    if (!tourDone) {
      setTimeout(() => startTour(dashboardSteps), 1500);
    }
  }, []);

  return (
    <div className="space-y-6">
      <DashboardStats />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div id="tour-stream-card" className="lg:col-span-2">
          <Suspense fallback={<div>Loading camera...</div>}>
            <StreamPlayer cameras={CAMERAS} />
          </Suspense>
        </div>

        <div id="tour-detections" className="space-y-6">
          <AllDetectionsCard />
        </div>
      </div>

      <div id="tour-charts" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AttendanceChart />
        <DivisionAttendanceChart />
      </div>
    </div>
  );
}
