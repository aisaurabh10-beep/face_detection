"use client";

import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";

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

interface ExportButtonProps {
  filters: {
    class: string;
    division: string;
    rollNumber: string;
    name: string;
  };
  dateRange: string;
  customStartDate: string;
  customEndDate: string;
  sortBy: string;
  sortOrder: string;
  onError: (message: string) => void;
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

export function ExportButton({
  filters,
  dateRange,
  customStartDate,
  customEndDate,
  sortBy,
  sortOrder,
  onError,
}: ExportButtonProps) {
  const [exportLoading, setExportLoading] = useState(false);

  const getDateRange = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    switch (dateRange as DateRangeOption) {
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

  const sortReports = (reports: AttendanceReport[]) => {
    return [...reports].sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy as SortOption) {
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
  };

  const generateFilename = (startDate: string, endDate: string) => {
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const filterStr = filters.class ? `_${filters.class}` : "";
    const rangeStr =
      dateRange === "custom" ? `_${startDate}_to_${endDate}` : `_${dateRange}`;
    return `attendance_report${filterStr}${rangeStr}_${dateStr}.csv`;
  };

  const createCSVContent = (
    reports: AttendanceReport[],
    startDate: string,
    endDate: string
  ) => {
    // Create report information at top
    const reportInfo = [
      ["Attendance Report"],
      [""],
      ["Report Information:"],
      ["Generated Date", new Date().toLocaleDateString()],
      ["Generated Time", new Date().toLocaleTimeString()],
      ["Date Range", `${startDate} to ${endDate}`],
      ["Total Students", reports.length],
      [""],
      ["Filters Applied:"],
      ["Class", filters.class || "All Classes"],
      ["Division", filters.division || "All Divisions"],
      ["Roll Number", filters.rollNumber || "All Roll Numbers"],
      ["Name Search", filters.name || "All Names"],
      [""],
      ["Attendance Data:"],
      [
        "Name",
        "Class",
        "Division",
        "Roll Number",
        "Working Days",
        "Present Days",
        "Present %",
        "Absent Days",
        "Absent %",
      ],
    ];

    const recordsData = reports.map((report) => [
      `"${report.student.firstName} ${report.student.lastName}"`,
      report.student.class,
      report.student.division,
      report.student.rollNumber,
      report.totalDays,
      report.presentDays,
      report.presentPercentage.toFixed(2),
      report.absentDays,
      report.absentPercentage.toFixed(2),
    ]);

    const csvContent = [
      ...reportInfo.map((row) => row.join(",")),
      ...recordsData.map((row) => row.join(",")),
    ].join("\n");

    return csvContent;
  };

  const downloadCSV = (csvContent: string, filename: string) => {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const { startDate, endDate } = getDateRange();

      // Fetch all data without pagination
      const res = await api.getAttendanceReport({
        page: 1,
        limit: 10000, // Large limit to get all data
        class: filters.class || undefined,
        division: filters.division || undefined,
        rollNumber: filters.rollNumber || undefined,
        name: filters.name || undefined,
        startDate,
        endDate,
      });

      const data = res.data?.data;
      const allReports = data?.reports || [];

      // Apply the same sorting as the UI
      const sortedReports = sortReports(allReports);

      // Create CSV content
      const csvContent = createCSVContent(sortedReports, startDate, endDate);

      // Generate filename and download
      const filename = generateFilename(startDate, endDate);
      downloadCSV(csvContent, filename);
    } catch (error) {
      console.error("Failed to export attendance data:", error);
      onError("Failed to export attendance data");
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <Button
      className="flex items-center gap-2"
      onClick={handleExport}
      disabled={exportLoading}
    >
      {exportLoading ? (
        <FileSpreadsheet className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {exportLoading ? "Exporting..." : "Export Report"}
    </Button>
  );
}
