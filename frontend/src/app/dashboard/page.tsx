"use client";

import { MainLayout } from "@/components/layout/main-layout";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
// import { RecentActivity } from "@/components/dashboard/recent-activity";
import { LastDetectionCard } from "@/components/dashboard/last-detection-card";
import { AttendanceChart } from "@/components/dashboard/attendance-chart";
import { DivisionAttendanceChart } from "@/components/dashboard/division-attendance-chart";
import StreamPlayer from "@/components/camera/StreamPlayer";
import { CAMERAS } from "@/lib/constants";

export default function DashboardPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <DashboardStats />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <StreamPlayer cameras={CAMERAS} />
          </div>

          <div className="space-y-6">
            {/* <RecentActivity /> */}
            <LastDetectionCard />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AttendanceChart />
          <DivisionAttendanceChart />
        </div>
      </div>
    </MainLayout>
  );
}
