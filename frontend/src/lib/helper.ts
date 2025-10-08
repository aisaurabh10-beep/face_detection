import { QuickStatItem } from "@/lib/types";
import config from "@/config/config";
import {
  Users,
  UserCheck,
  UserX,
  TrendingUp,
  Clock,
  Activity,
  AlertTriangle,
  BarChart3,
  Calendar,
  Camera,
  LayoutDashboard,
  UserPlus,
} from "lucide-react";

// Static classes list (used as enum-like values, also persisted in DB)
export const CLASSES = [
  "Class 1",
  "Class 2",
  "Class 3",
  "Class 4",
  "Class 5",
  "Class 6",
  "Class 7",
  "Class 8",
  "Class 9",
  "Class 10",
] as const;

export const DIVISIONS = {
  "Class 1": ["A", "B", "C"],
  "Class 2": ["A", "B", "C"],
  "Class 3": ["A", "B", "C"],
  "Class 4": ["A", "B", "C"],
  "Class 5": ["A", "B", "C"],
  "Class 6": ["A", "B", "C"],
  "Class 7": ["A", "B", "C"],
  "Class 8": ["A", "B", "C"],
  "Class 9": ["A", "B", "C"],
  "Class 10": ["A", "B", "C"],
} as const;

export const getDivisionsForClass = (className?: string): readonly string[] => {
  return DIVISIONS[className];
};

export const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Overview and statistics",
  },
  {
    name: "Live Stream",
    href: "/stream",
    icon: Camera,
    description: "Real-time camera feed",
  },
  {
    name: "Students",
    href: "/students",
    icon: Users,
    description: "Manage student profiles",
  },
  {
    name: "Attendance",
    href: "/attendance",
    icon: Calendar,
    description: "View attendance records",
  },
];

export const defaultQuickStats: QuickStatItem[] = [
  {
    name: "Present Today",
    value: "-",
    icon: UserCheck,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  {
    name: "Absent Today",
    value: "-",
    icon: Users,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    name: "Unknown Faces",
    value: "-",
    icon: AlertTriangle,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
  },
];

export const getPageName = (pathname: string): string => {
  const pathMap: { [key: string]: string } = {
    "/": "Dashboard",
    "/dashboard": "Dashboard",
    "/students": "Students",
    "/students/register": "Register Student",
    "/attendance": "Attendance",
    "/cameras": "Cameras",
    "/reports": "Reports",
    "/stream": "Live Stream",
  };

  if (pathMap[pathname]) {
    return pathMap[pathname];
  }

  if (pathname.startsWith("/attendance/student/")) {
    return "Student Attendance Details";
  }

  if (pathname.startsWith("/students/") && pathname !== "/students/register") {
    return "Student Details";
  }
  return "Dashboard";
};

// Build absolute URL for photos or static files coming from backend
export const getPicUrl = (
  relativeOrAbsolute: string | undefined | null
): string => {
  if (!relativeOrAbsolute) return "/api/placeholder/48/48";
  if (relativeOrAbsolute.startsWith("http")) return relativeOrAbsolute;
  const base = config.apiBaseUrl.replace(/\/?api$/, "");
  const trimmed = relativeOrAbsolute.replace(/^\//, "");
  return `${base}/${trimmed}`;
};

const totalDivisions = Object.values(DIVISIONS).reduce(
  (sum, divisions) => sum + divisions.length,
  0
);

// Default cards config for dashboard stats
export const defaultDashboardStats = [
  {
    title: "Total Students",
    value: "-",
    icon: Users,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    title: "Present Today",
    value: "-",
    icon: UserCheck,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  {
    title: "Absent Today",
    value: "-",
    icon: UserX,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
  },
  {
    title: "Attendance Rate",
    value: "-",
    icon: TrendingUp,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  // {
  //   title: "Late Arrivals",
  //   value: "-",
  //   icon: Clock,
  //   color: "text-yellow-500",
  //   bgColor: "bg-yellow-500/10",
  // },
  {
    title: "Total Classes",
    value: CLASSES.length,
    icon: Users,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  {
    title: "Total Divisions",
    value: totalDivisions,
    icon: UserPlus,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
  },
];
