"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { defaultQuickStats, navigation } from "@/lib/helper";
import { QuickStatItem } from "@/lib/types";
import Lottie from "lottie-react";

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();
  const [quickStats, setQuickStats] =
    useState<QuickStatItem[]>(defaultQuickStats);
  const [cctvAnimation, setCctvAnimation] = useState<any>(null);

  // Load Lottie animation
  useEffect(() => {
    fetch("/CCTV Camera.json")
      .then((res) => res.json())
      .then((data) => setCctvAnimation(data))
      .catch((err) => console.error("Failed to load Lottie animation:", err));
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!mounted) return;
        // Fetch total students count
        const res = await api.getStudents({ page: 1, limit: 1 });
        const totalStudents = res?.data?.data?.total || 0;

        if (!mounted) return;
        setQuickStats((prev) =>
          prev.map((item) => {
            if (item.name === "Total Students") {
              return { ...item, value: String(totalStudents) };
            }
            // Total Classes and Total Divisions are already set from defaultQuickStats
            return item;
          }),
        );
      } catch (e) {
        console.error("Failed to load student stats:", e);
        // leave defaults on error
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Commented out - Previous stats fetching (Present Today, Absent Today, Unknown Faces)
  // useEffect(() => {
  //   let mounted = true;
  //   const controller = new AbortController();
  //   (async () => {
  //     try {
  //       if (!mounted) return;
  //       const res = await api.getAttendanceStats(undefined, controller);
  //       const stats = res?.data?.data;
  //       const total = stats.totalStudents || 0;
  //       const present = stats.presentStudents ?? 0;
  //       const absent =
  //         stats.absentStudents ??
  //         (total > 0 ? Math.max(total - present, 0) : 0);
  //       const absentPct =
  //         total > 0 ? ((absent / total) * 100).toFixed(1) : "0.0";
  //       const presentPct =
  //         total > 0 ? ((present / total) * 100).toFixed(1) : "0.0";
  //       const unknownFaces = Number(stats.unknownFacesToday) || 0;

  //       const presentLabel = `${present} (${presentPct}%)`;
  //       const absentLabel = `${absent} (${absentPct}%)`;
  //       setQuickStats((prev) =>
  //         prev.map((item) => {
  //           if (item.name === "Present Today") {
  //             return { ...item, value: presentLabel };
  //           }
  //           if (item.name === "Absent Today") {
  //             return { ...item, value: absentLabel };
  //           }
  //           if (item.name === "Unknown Faces") {
  //             return { ...item, value: String(unknownFaces) };
  //           }
  //           return item;
  //         })
  //       );
  //     } catch (e) {
  //       console.error("Failed to load attendance stats:", e);
  //       if (!axios.isCancel(e)) {
  //         // leave defaults on error
  //       }
  //     }
  //   })();

  //   return () => {
  //     mounted = false;
  //     controller.abort();
  //   };
  // }, []);

  return (
    <div
      id="tour-sidebar"
      className={cn(
        "flex h-full flex-col bg-card border-r transition-all duration-300",
        isCollapsed ? "w-16" : "w-64",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 ">
        {!isCollapsed && (
          <div className="flex items-center space-x-2">
            <div className="w-11 h-11 rounded-lg flex items-center justify-center overflow-hidden">
              {cctvAnimation ? (
                <Lottie
                  animationData={cctvAnimation}
                  loop={true}
                  autoplay={true}
                  className="w-full h-full"
                />
              ) : (
                <div className="w-5 h-5 bg-primary-foreground/20 rounded animate-pulse" />
              )}
            </div>
            <Link href="/" className="cursor-pointer">
              <div>
                <h1 className="text-lg font-semibold">BharathaTechno</h1>
                <p className="text-xs text-muted-foreground">
                  AI Attendance System
                </p>
              </div>
            </Link>
          </div>
        )}
      </div>

      <div className="px-3 pb-1 flex justify-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="h-8 w-auto px-0 hover:bg-transparent hover:text-inherit"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <Menu className="h-4 w-4" />
          ) : (
            <div className="flex items-center space-x-2 bg-secondary text-primary rounded-md px-2 py-1">
              <X className="h-4 w-4" />
              <span>Close Sidebar</span>
            </div>
          )}
        </Button>
      </div>

      {/* Quick Stats */}
      {!isCollapsed && (
        <div className="p-4 space-y-3">
          {/* <h3 className="text-sm font-medium text-muted-foreground">
          Overview
          </h3> */}
          <div className="space-y-2">
            {quickStats.map((stat) => (
              <div
                key={stat.name}
                className="flex items-center space-x-3 p-2 rounded-lg bg-muted/50"
              >
                <div className={cn("p-2 rounded-lg", stat.bgColor)}>
                  <stat.icon className={cn("h-4 w-4", stat.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">{stat.name}</p>
                  <p className="text-sm font-semibold">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sidebar toggle button next to nav (close / open) */}

      <nav className="flex-1 p-4 space-y-1 ">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center space-x-3 px-2 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent",
              )}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <div>{item.name}</div>
                  <div className="text-xs opacity-70">{item.description}</div>
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      {!isCollapsed && (
        <div id="tour-system-status" className="p-4 border-t">
          <div className="flex items-center space-x-3 p-2 rounded-lg bg-muted/50">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">System Status</p>
              <div className="flex items-center space-x-2">
                <Badge variant="success" className="text-xs">
                  Online
                </Badge>
                <span className="text-xs text-muted-foreground">
                  All systems operational
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
