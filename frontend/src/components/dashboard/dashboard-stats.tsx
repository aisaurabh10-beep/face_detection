"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { defaultDashboardStats } from "@/lib/helper";
import { useSocket } from "@/lib/socket";

export function DashboardStats() {
  const { on, off } = useSocket();
  const [refreshToken, setRefreshToken] = useState(0);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalStudents: 0,
    presentToday: 0,
    absentToday: 0,
    attendanceRate: 0,
    lateArrivals: 0,
  });

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        const statsRes = await api.getAttendanceStats(undefined, controller);
        if (!mounted) return;
        const s = statsRes.data.data;
        setStats({
          totalStudents: s.totalStudents || 0,
          presentToday: s.presentStudents || 0,
          absentToday: s.absentStudents || 0,
          attendanceRate: s.attendancePercentage || 0,
          lateArrivals: s.lateArrivals || 0,
        });
      } catch (e) {
        console.error("Failed to load dashboard stats:", e);
        // ignore for POC
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [refreshToken]);

  // Listen for attendance events to refresh stats
  useEffect(() => {
    const handleAttendanceMarked = () => {
      console.log("Attendance marked, refreshing dashboard stats");
      setRefreshToken((prev) => prev + 1);
    };

    on("attendance_marked", handleAttendanceMarked as any);

    return () => {
      off("attendance_marked", handleAttendanceMarked as any);
    };
  }, [on, off]);

  const items = loading
    ? defaultDashboardStats
    : defaultDashboardStats.map((cfg) => {
        let value = cfg.value as string;
        switch (cfg.title) {
          case "Total Students":
            value = String(stats.totalStudents);
            break;
          case "Present Today": {
            const pct =
              stats.totalStudents > 0
                ? (stats.presentToday / stats.totalStudents) * 100
                : 0;
            value = `${stats.presentToday} (${pct.toFixed(1)}%)`;
            break;
          }
          case "Absent Today": {
            const pct =
              stats.totalStudents > 0
                ? (stats.absentToday / stats.totalStudents) * 100
                : 0;
            value = `${stats.absentToday} (${pct.toFixed(1)}%)`;
            break;
          }
          case "Attendance Rate":
            value = `${stats.attendanceRate.toFixed(1)}%`;
            break;

          default:
            break;
        }
        return { ...cfg, value };
      });

  return (
    <>
      {/* <div>
        <p className="text-muted-foreground">
          Monitor real-time attendance and system status
        </p>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setRefreshToken((v) => v + 1)}
          aria-label="Refresh stats"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div> */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {items.map((stat) => (
          <Card key={stat.title} className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={cn("p-2 rounded-lg", stat.bgColor)}>
                <stat.icon className={cn("h-4 w-4", stat.color)} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/5 pointer-events-none" />
          </Card>
        ))}
      </div>
    </>
  );
}
