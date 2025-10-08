"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Calendar, Maximize2, Minimize2 } from "lucide-react";
import { api } from "@/lib/api";
import { DailyClassWiseResponse } from "@/lib/types";
import { CLASSES } from "@/lib/helper";

export function AttendanceChart() {
  const [state, setState] = useState<{
    loading: boolean;
    date: string;
    data: DailyClassWiseResponse | null;
  }>({
    loading: false,
    date: new Date().toISOString().slice(0, 10),
    data: null,
  });

  const [isExpanded, setIsExpanded] = useState(false);
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    const fetchData = async () => {
      try {
        setState((s) => ({ ...s, loading: true }));
        const res = await api.getDailyClassWise(state.date, controller);
        if (!mounted) return;
        setState((s) => ({
          ...s,
          data: res.data.data || res.data,
          loading: false,
        }));
      } catch (e) {
        console.error("Failed to load attendance chart data:", e);
        if (mounted) setState((s) => ({ ...s, loading: false }));
      }
    };

    fetchData();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [state.date]);

  const classesData = useMemo(() => {
    const base = CLASSES.map((c) => ({
      className: c,
      present: 0,
      absent: 0,
      total: 0,
    }));
    if (!state.data?.classes) return base;
    const map = new Map<
      string,
      { className: string; present: number; absent: number; total: number }
    >();
    base.forEach((b) => map.set(b.className, { ...b }));
    state.data.classes.forEach((cls) => {
      map.set(cls.className, {
        className: cls.className,
        present: cls.present,
        absent: cls.absent,
        total: cls.total,
      });
    });
    return Array.from(map.values());
  }, [state.data]);

  // Totals are now provided from backend summary. We keep this only as a safe fallback if summary is missing.
  const totalFallback = useMemo(() => {
    const totals = classesData.reduce(
      (acc, c) => {
        acc.present += c.present;
        acc.absent += c.absent;
        acc.total += c.total;
        return acc;
      },
      { present: 0, absent: 0, total: 0 }
    );
    return totals;
  }, [classesData]);

  const unknownFaces = state.data?.summary?.unknownFaces ?? 0;
  const totalAbsent = state.data?.summary?.totalAbsent ?? totalFallback.absent;
  const totalAbsentPct =
    state.data?.summary?.totalAbsentPercentage ??
    (totalFallback.total > 0 ? (totalAbsent / totalFallback.total) * 100 : 0);
  const totalPresent =
    state.data?.summary?.totalPresent ?? totalFallback.present;
  const totalPresentPct =
    state.data?.summary?.totalPresentPercentage ??
    (totalFallback.total > 0 ? (totalPresent / totalFallback.total) * 100 : 0);

  const card = (
    <Card className={cn(isExpanded && "max-w-6xl mx-auto")}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-lg font-semibold">
            Class-wise Attendance
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Per-class present/absent for selected day
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div
            className="relative flex items-center h-9 rounded-md border border-input bg-background px-3 text-sm cursor-pointer select-none"
            onClick={() => {
              const el = dateInputRef.current;
              if (!el) return;
              try {
                const anyEl = el as unknown as { showPicker?: () => void };
                if (typeof anyEl.showPicker === "function") {
                  anyEl.showPicker();
                } else {
                  el.focus();
                  el.click();
                }
              } catch {
                el.focus();
              }
            }}
            aria-label="Change date"
            role="button"
            tabIndex={0}
          >
            <span className="mr-2">{state.date}</span>
            <Calendar className="h-4 w-4" />
            <input
              ref={dateInputRef}
              type="date"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              value={state.date}
              onChange={(e) =>
                setState((s) => ({ ...s, date: e.target.value }))
              }
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={isExpanded ? "Collapse" : "Expand"}
            onClick={() => setIsExpanded((v) => !v)}
          >
            {isExpanded ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 rounded-lg bg-yellow-500/10">
            <div className="text-xs text-muted-foreground">Unknown Faces</div>
            <div className="text-lg font-semibold text-yellow-500">
              {unknownFaces}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-green-500/10">
            <div className="text-xs text-muted-foreground">Total Present</div>
            <div className="text-lg font-semibold text-green-500">
              {totalPresent} ({totalPresentPct.toFixed(1)}%)
            </div>
          </div>
          <div className="p-3 rounded-lg bg-red-500/10">
            <div className="text-xs text-muted-foreground">Total Absent</div>
            <div className="text-lg font-semibold text-red-500">
              {totalAbsent} ({totalAbsentPct.toFixed(1)}%)
            </div>
          </div>
        </div>

        {/* Per-class chart */}
        <div className="space-y-2">
          {classesData.map((c) => {
            const presentPct =
              (c as any).presentPercentage ??
              (c.total > 0 ? (c.present / c.total) * 100 : 0);
            const absentPct =
              (c as any).absentPercentage ??
              (c.total > 0 ? (c.absent / c.total) * 100 : 0);
            return (
              <div key={c.className} className="flex items-center space-x-3">
                <div className="w-20 text-xs text-muted-foreground font-medium">
                  {c.className}
                </div>
                <div className="flex-1">
                  <div className="h-8 bg-muted rounded-lg overflow-hidden flex">
                    <div
                      className={cn("h-full bg-green-500")}
                      style={{ width: `${presentPct}%` }}
                      title={`Present ${c.present}/${
                        c.total
                      } (${presentPct.toFixed(1)}%)`}
                    />
                    <div
                      className={cn("h-full bg-red-500")}
                      style={{ width: `${absentPct}%` }}
                      title={`Absent ${c.absent}/${
                        c.total
                      } (${absentPct.toFixed(1)}%)`}
                    />
                  </div>
                </div>
                <div className="w-32 text-right text-xs">
                  <span className="text-green-500 font-medium mr-2">
                    {c.present} ({presentPct.toFixed(1)}%)
                  </span>
                  <span className="text-red-500">
                    {c.absent} ({absentPct.toFixed(1)}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center space-x-6 text-xs">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span className="text-muted-foreground">Present</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span className="text-muted-foreground">Absent</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return isExpanded ? (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm overflow-auto p-6">
      {card}
    </div>
  ) : (
    card
  );
}
