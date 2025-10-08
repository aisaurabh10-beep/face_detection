"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Calendar, Maximize2, Minimize2, Users } from "lucide-react";
import { api } from "@/lib/api";
import { CLASSES, DIVISIONS } from "@/lib/helper";

interface DivisionAttendanceData {
  className: string;
  division: string;
  present: number;
  absent: number;
  total: number;
  presentPercentage: number;
  absentPercentage: number;
}

export function DivisionAttendanceChart() {
  const [state, setState] = useState<{
    loading: boolean;
    date: string;
    selectedClass: string;
    data: DivisionAttendanceData[] | null;
  }>({
    loading: false,
    date: new Date().toISOString().slice(0, 10),
    selectedClass: CLASSES[0],
    data: null,
  });

  const [isExpanded, setIsExpanded] = useState(false);
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!state.selectedClass || !state.date) return;

    const controller = new AbortController();
    let mounted = true;

    const fetchData = async () => {
      try {
        setState((s) => ({ ...s, loading: true }));

        // Fetch attendance report for the selected class and date
        const res = await api.getAttendanceReport({
          page: 1,
          limit: 10000,
          class: state.selectedClass,
          startDate: state.date,
          endDate: state.date,
        });

        if (!mounted) return;

        const reports = res.data?.data?.reports || [];

        // Get all divisions for the selected class from helper
        const allDivisions =
          DIVISIONS[state.selectedClass as keyof typeof DIVISIONS] || [];

        // Initialize division map with all divisions
        const divisionMap = new Map<
          string,
          {
            present: number;
            absent: number;
            total: number;
          }
        >();

        // Initialize all divisions with zero values
        allDivisions.forEach((division) => {
          divisionMap.set(division, { present: 0, absent: 0, total: 0 });
        });

        // Populate with actual data
        reports.forEach((report: any) => {
          const division = report.student.division;
          if (divisionMap.has(division)) {
            const divisionData = divisionMap.get(division)!;
            divisionData.present += report.presentDays;
            divisionData.absent += report.absentDays;
            divisionData.total += report.totalDays;
          }
        });

        // Convert to array format, ensuring all divisions are included
        const divisionData: DivisionAttendanceData[] = allDivisions.map(
          (division) => {
            const data = divisionMap.get(division) || {
              present: 0,
              absent: 0,
              total: 0,
            };
            return {
              className: state.selectedClass,
              division,
              present: data.present,
              absent: data.absent,
              total: data.total,
              presentPercentage:
                data.total > 0 ? (data.present / data.total) * 100 : 0,
              absentPercentage:
                data.total > 0 ? (data.absent / data.total) * 100 : 0,
            };
          }
        );

        setState((s) => ({
          ...s,
          data: divisionData,
          loading: false,
        }));
      } catch (e) {
        console.error("Failed to load division attendance data:", e);
        if (mounted) setState((s) => ({ ...s, loading: false }));
      }
    };

    fetchData();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [state.date, state.selectedClass]);

  const totalStats = useMemo(() => {
    if (!state.data)
      return {
        present: 0,
        absent: 0,
        total: 0,
        presentPercentage: 0,
        absentPercentage: 0,
      };

    const totals = state.data.reduce(
      (acc, division) => {
        acc.present += division.present;
        acc.absent += division.absent;
        acc.total += division.total;
        return acc;
      },
      { present: 0, absent: 0, total: 0 }
    );

    return {
      ...totals,
      presentPercentage:
        totals.total > 0 ? (totals.present / totals.total) * 100 : 0,
      absentPercentage:
        totals.total > 0 ? (totals.absent / totals.total) * 100 : 0,
    };
  }, [state.data]);

  const card = (
    <Card className={cn(isExpanded && "max-w-6xl mx-auto")}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-lg font-semibold">
            Division-wise Attendance
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Per-division attendance
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <select
            className="h-9 px-3 border rounded-md bg-background text-sm w-40"
            value={state.selectedClass}
            onChange={(e) =>
              setState((s) => ({ ...s, selectedClass: e.target.value }))
            }
          >
            <option value="">Select Class</option>
            {CLASSES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
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
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!state.selectedClass ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <div className="text-center">
              <Users className="h-8 w-8 mx-auto mb-2" />
              <p>Please select a class to view division-wise attendance</p>
            </div>
          </div>
        ) : state.loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : !state.data || state.data.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <div className="text-center">
              <Users className="h-8 w-8 mx-auto mb-2" />
              <p>
                No attendance data found for {state.selectedClass} on{" "}
                {state.date}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <div className="text-xs text-muted-foreground">
                  Total Students
                </div>
                <div className="text-lg font-semibold text-blue-500">
                  {totalStats.total}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10">
                <div className="text-xs text-muted-foreground">
                  Total Present
                </div>
                <div className="text-lg font-semibold text-green-500">
                  {totalStats.present} (
                  {totalStats.presentPercentage.toFixed(1)}%)
                </div>
              </div>
              <div className="p-3 rounded-lg bg-red-500/10">
                <div className="text-xs text-muted-foreground">
                  Total Absent
                </div>
                <div className="text-lg font-semibold text-red-500">
                  {totalStats.absent} ({totalStats.absentPercentage.toFixed(1)}
                  %)
                </div>
              </div>
            </div>

            {/* Per-division chart */}
            <div className="space-y-2">
              {state.data.map((division) => (
                <div
                  key={division.division}
                  className="flex items-center space-x-3"
                >
                  <div className="w-20 text-xs text-muted-foreground font-medium">
                    Div {division.division}
                  </div>
                  <div className="flex-1">
                    <div className="h-8 bg-muted rounded-lg overflow-hidden flex">
                      <div
                        className={cn("h-full bg-green-500")}
                        style={{ width: `${division.presentPercentage}%` }}
                        title={`Present ${division.present}/${
                          division.total
                        } (${division.presentPercentage.toFixed(1)}%)`}
                      />
                      <div
                        className={cn("h-full bg-red-500")}
                        style={{ width: `${division.absentPercentage}%` }}
                        title={`Absent ${division.absent}/${
                          division.total
                        } (${division.absentPercentage.toFixed(1)}%)`}
                      />
                    </div>
                  </div>
                  <div className="w-32 text-right text-xs">
                    <span className="text-green-500 font-medium mr-2">
                      {division.present} (
                      {division.presentPercentage.toFixed(1)}%)
                    </span>
                    <span className="text-red-500">
                      {division.absent} ({division.absentPercentage.toFixed(1)}
                      %)
                    </span>
                  </div>
                </div>
              ))}
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
          </div>
        )}
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
