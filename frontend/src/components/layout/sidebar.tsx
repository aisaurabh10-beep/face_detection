"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import axios from "axios";
import { Menu, X, Activity } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { defaultQuickStats, navigation } from "@/lib/helper";
import { QuickStatItem } from "@/lib/types";

// navigation and defaultQuickStats moved to @/lib/helper
// types moved to @/lib/types

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();
  const [quickStats, setQuickStats] =
    useState<QuickStatItem[]>(defaultQuickStats);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    (async () => {
      try {
        if (!mounted) return;
        const res = await api.getAttendanceStats(undefined, controller);
        const stats = res?.data?.data;
        const total = stats.totalStudents || 0;
        const present = stats.presentStudents ?? 0;
        const absent =
          stats.absentStudents ??
          (total > 0 ? Math.max(total - present, 0) : 0);
        const absentPct =
          total > 0 ? ((absent / total) * 100).toFixed(1) : "0.0";
        const presentPct =
          total > 0 ? ((present / total) * 100).toFixed(1) : "0.0";
        const unknownFaces = Number(stats.unknownFacesToday) || 0;

        const presentLabel = `${present} (${presentPct}%)`;
        const absentLabel = `${absent} (${absentPct}%)`;
        setQuickStats((prev) =>
          prev.map((item) => {
            if (item.name === "Present Today") {
              return { ...item, value: presentLabel };
            }
            if (item.name === "Absent Today") {
              return { ...item, value: absentLabel };
            }
            if (item.name === "Unknown Faces") {
              return { ...item, value: String(unknownFaces) };
            }
            return item;
          })
        );
      } catch (e) {
        if (!axios.isCancel(e)) {
          // leave defaults on error
        }
      }
    })();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  return (
    <div
      className={cn(
        "flex h-full flex-col bg-card border-r transition-all duration-300",
        isCollapsed ? "w-16" : "w-64",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 ">
        {!isCollapsed && (
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Bishop's School</h1>
              <p className="text-xs text-muted-foreground">AI Attendance System</p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-8 w-8"
        >
          {isCollapsed ? (
            <Menu className="h-4 w-4" />
          ) : (
            <X className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Quick Stats */}
      {!isCollapsed && (
        <div className="p-4 space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Today&apos;s Overview
          </h3>
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

      {/* Navigation */}
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
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
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
        <div className="p-4 border-t">
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
