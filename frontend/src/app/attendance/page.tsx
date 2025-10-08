"use client";

import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Calendar, ArrowUpDown, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  getPicUrl,
  CLASSES,
  getDivisionsForClass,
  DIVISIONS,
} from "@/lib/helper";
import { ExportButton } from "@/components/attendance/ExportButton";

interface AttendanceReport {
  student: {
    _id: string;
    studentId: string;
    firstName: string;
    lastName: string;
    class: string;
    division: string;
    rollNumber: string;
    photos?: string[];
  };
  totalDays: number;
  presentDays: number;
  absentDays: number;
  presentPercentage: number;
  absentPercentage: number;
}

type DateRangeOption =
  | "current-month"
  | "last-month"
  | "last-3-months"
  | "last-6-months"
  | "current-year"
  | "last-year"
  | "custom";

type SortOption =
  | "rollNumber"
  | "name"
  | "presentPercentage"
  | "absentPercentage";
type SortOrder = "asc" | "desc";

export default function AttendancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [attendanceData, setAttendanceData] = useState<AttendanceReport[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [filters, setFilters] = useState({
    class: "",
    division: "",
    rollNumber: "",
    name: "",
  });
  const [dateRange, setDateRange] = useState<DateRangeOption>("current-month");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("rollNumber");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const availableDivisions = useMemo(() => {
    const list = Object.values(DIVISIONS).flat();
    return Array.from(new Set(list));
  }, []);

  const getDateRange = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    switch (dateRange) {
      case "current-month":
        return {
          startDate: startOfMonth.toISOString().split("T")[0],
          endDate: endOfMonth.toISOString().split("T")[0],
        };
      case "last-month":
        const lastMonthStart = new Date(
          now.getFullYear(),
          now.getMonth() - 1,
          1
        );
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        return {
          startDate: lastMonthStart.toISOString().split("T")[0],
          endDate: lastMonthEnd.toISOString().split("T")[0],
        };
      case "last-3-months":
        const threeMonthsAgo = new Date(
          now.getFullYear(),
          now.getMonth() - 3,
          1
        );
        return {
          startDate: threeMonthsAgo.toISOString().split("T")[0],
          endDate: now.toISOString().split("T")[0],
        };
      case "last-6-months":
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        return {
          startDate: sixMonthsAgo.toISOString().split("T")[0],
          endDate: now.toISOString().split("T")[0],
        };
      case "current-year":
        const yearStart = new Date(now.getFullYear(), 0, 1);
        const yearEnd = new Date(now.getFullYear(), 11, 31);
        return {
          startDate: yearStart.toISOString().split("T")[0],
          endDate: yearEnd.toISOString().split("T")[0],
        };
      case "last-year":
        const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
        const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31);
        return {
          startDate: lastYearStart.toISOString().split("T")[0],
          endDate: lastYearEnd.toISOString().split("T")[0],
        };
      case "custom":
        return {
          startDate: customStartDate,
          endDate: customEndDate,
        };
      default:
        return {
          startDate: startOfMonth.toISOString().split("T")[0],
          endDate: endOfMonth.toISOString().split("T")[0],
        };
    }
  };

  const fetchAttendanceData = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const { startDate, endDate } = getDateRange();
      const res = await api.getAttendanceReport({
        page,
        limit,
        class: filters.class || undefined,
        division: filters.division || undefined,
        rollNumber: filters.rollNumber || undefined,
        name: filters.name || undefined,
        startDate,
        endDate,
      });
      const data = res.data?.data;
      setAttendanceData(data?.reports || []);
      setTotal(data?.total || 0);
    } catch (e) {
      setErrorMsg("Failed to load attendance data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, dateRange, customStartDate, customEndDate]);

  const sortedData = useMemo(() => {
    const sorted = [...attendanceData].sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case "rollNumber":
          aValue = parseInt(a.student.rollNumber) || 0;
          bValue = parseInt(b.student.rollNumber) || 0;
          break;
        case "name":
          aValue = `${a.student.firstName} ${a.student.lastName}`.toLowerCase();
          bValue = `${b.student.firstName} ${b.student.lastName}`.toLowerCase();
          break;
        case "presentPercentage":
          aValue = a.presentPercentage;
          bValue = b.presentPercentage;
          break;
        case "absentPercentage":
          aValue = a.absentPercentage;
          bValue = b.absentPercentage;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [attendanceData, sortBy, sortOrder]);

  const handleSort = (column: SortOption) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  const handleRowClick = (studentId: string) => {
    router.push(`/attendance/student/${studentId}`);
  };

  const ProgressBar = ({
    present,
    absent,
  }: {
    present: number;
    absent: number;
  }) => (
    <div className="w-full bg-gray-200 rounded-full h-2.5">
      <div className="flex h-2.5 rounded-full overflow-hidden">
        <div
          className="bg-green-500"
          style={{ width: `${present}%` }}
          title={`Present: ${present.toFixed(1)}%`}
        />
        <div
          className="bg-red-500"
          style={{ width: `${absent}%` }}
          title={`Absent: ${absent.toFixed(1)}%`}
        />
      </div>
    </div>
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground">
              View and analyze student attendance records
            </p>
          </div>
          <ExportButton
            filters={filters}
            dateRange={dateRange}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onError={setErrorMsg}
          />
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters & Date Range</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name"
                  className="pl-10"
                  value={filters.name}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div>
                <select
                  className="h-9 w-full px-3 border rounded-md bg-background text-sm"
                  value={filters.class}
                  onChange={(e) => {
                    setFilters((f) => ({
                      ...f,
                      class: e.target.value,
                      division: "", // Reset division when class changes
                    }));
                  }}
                >
                  <option value="">All Classes</option>
                  {CLASSES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  className="h-9 w-full px-3 border rounded-md bg-background text-sm"
                  value={filters.division}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, division: e.target.value }))
                  }
                >
                  <option value="">All Divisions</option>
                  {availableDivisions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                placeholder="Roll Number"
                value={filters.rollNumber}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, rollNumber: e.target.value }))
                }
              />
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPage(1);
                    fetchAttendanceData();
                  }}
                >
                  Apply
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setFilters({
                      class: "",
                      division: "",
                      rollNumber: "",
                      name: "",
                    });
                    setPage(1);
                    fetchAttendanceData();
                  }}
                >
                  Reset
                </Button>
              </div>
            </div>

            {/* Date Range Selection */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-48">
                <select
                  className="h-9 w-full px-3 border rounded-md bg-background text-sm"
                  value={dateRange}
                  onChange={(e) =>
                    setDateRange(e.target.value as DateRangeOption)
                  }
                >
                  <option value="current-month">Current Month</option>
                  <option value="last-month">Last Month</option>
                  <option value="last-3-months">Last 3 Months</option>
                  <option value="last-6-months">Last 6 Months</option>
                  <option value="current-year">Current Year</option>
                  <option value="last-year">Last Year</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>
              {dateRange === "custom" && (
                <>
                  <div className="w-40">
                    <Input
                      type="date"
                      placeholder="Start Date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="[&::-webkit-calendar-picker-indicator]:invert"
                    />
                  </div>
                  <div className="w-40">
                    <Input
                      type="date"
                      placeholder="End Date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="[&::-webkit-calendar-picker-indicator]:invert"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Sort Options */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm font-medium">Sort by:</span>
              <select
                className="h-8 px-2 border rounded-md bg-background text-sm"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
              >
                <option value="rollNumber">Roll Number</option>
                <option value="name">Name</option>
                <option value="presentPercentage">Present %</option>
                <option value="absentPercentage">Absent %</option>
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                }
                className="h-8 px-2"
              >
                <ArrowUpDown className="h-3 w-3" />
                {sortOrder === "asc" ? "↑" : "↓"}
              </Button>
            </div>

            {/* Attendance Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                {sortedData.length ? (
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-2 pr-2">Photo</th>
                      <th
                        className="py-2 pr-2 cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort("name")}
                      >
                        Name{" "}
                        {sortBy === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                      </th>
                      <th className="py-2 pr-2">Class</th>
                      <th className="py-2 pr-2">Division</th>
                      <th
                        className="py-2 pr-2 cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort("rollNumber")}
                      >
                        Roll Number{" "}
                        {sortBy === "rollNumber" &&
                          (sortOrder === "asc" ? "↑" : "↓")}
                      </th>
                      <th className="py-2 pr-2">Working Days</th>
                      <th
                        className="py-2 pr-2 cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort("presentPercentage")}
                      >
                        Present Days{" "}
                        {sortBy === "presentPercentage" &&
                          (sortOrder === "asc" ? "↑" : "↓")}
                      </th>
                      <th
                        className="py-2 pr-2 cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort("absentPercentage")}
                      >
                        Absent Days{" "}
                        {sortBy === "absentPercentage" &&
                          (sortOrder === "asc" ? "↑" : "↓")}
                      </th>
                      <th className="py-2 pr-2">Attendance Chart</th>
                    </tr>
                  </thead>
                ) : null}

                <tbody>
                  {sortedData.map((report) => (
                    <tr
                      key={report.student._id}
                      className="border-t cursor-pointer hover:bg-gray-900 transition-colors"
                      onClick={() => handleRowClick(report.student._id)}
                    >
                      <td className="py-2 pr-2">
                        <div className="w-10 h-10 rounded overflow-hidden bg-muted">
                          <img
                            src={getPicUrl(
                              (report.student.photos &&
                                report.student.photos[0]) ||
                                ""
                            )}
                            alt=""
                            className="w-10 h-10 object-cover"
                          />
                        </div>
                      </td>
                      <td className="py-2 pr-2">
                        {report.student.firstName} {report.student.lastName}
                      </td>
                      <td className="py-2 pr-2">{report.student.class}</td>
                      <td className="py-2 pr-2">{report.student.division}</td>
                      <td className="py-2 pr-2">{report.student.rollNumber}</td>
                      <td className="py-2 pr-2">
                        <span className="font-medium text-blue-600">
                          {report.totalDays}
                        </span>
                      </td>
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="text-green-600 font-medium">
                            {report.presentDays}
                          </span>
                          <span className="text-muted-foreground">
                            ({report.presentPercentage.toFixed(1)}%)
                          </span>
                        </div>
                      </td>
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="text-red-600 font-medium">
                            {report.absentDays}
                          </span>
                          <span className="text-muted-foreground">
                            ({report.absentPercentage.toFixed(1)}%)
                          </span>
                        </div>
                      </td>
                      <td className="py-2 pr-2">
                        <div className="w-32">
                          <ProgressBar
                            present={report.presentPercentage}
                            absent={report.absentPercentage}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!sortedData?.length && !loading && (
                    <tr>
                      <td colSpan={9} className="py-6 text-center">
                        <div className="flex flex-col items-center space-y-3">
                          <Users className="h-12 w-12 text-muted-foreground" />
                          <div className="text-muted-foreground">
                            <p className="text-lg font-medium">
                              No attendance data found
                            </p>
                            <p className="text-sm">
                              Try adjusting your filters or date range
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {sortedData.length ? (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Page {page} of {Math.max(1, Math.ceil(total / limit))}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    disabled={page >= Math.ceil(total / limit)}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
