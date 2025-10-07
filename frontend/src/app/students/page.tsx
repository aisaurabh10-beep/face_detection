"use client";

import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Users, UserPlus } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import {
  getPicUrl,
  CLASSES,
  getDivisionsForClass,
  DIVISIONS,
} from "@/lib/helper";

export default function StudentsPage() {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [classesCount, setClassesCount] = useState(0);
  const [divisionsCount, setDivisionsCount] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);
  const [filters, setFilters] = useState({
    class: "",
    division: "",
    rollNumber: "",
    email: "",
    name: "",
  });

  const fetchStudents = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await api.getStudents({
        page,
        limit,
        class: filters.class || undefined,
        division: filters.division || undefined,
        rollNumber: filters.rollNumber || undefined,
        email: filters.email || undefined,
        name: filters.name || undefined,
      });
      const data = res.data?.data;
      setStudents(data?.students || []);
      setTotal(data?.total || 0);
      setClassesCount(data?.classesCount || 0);
      setDivisionsCount(data?.divisionsCount || 0);
    } catch (e) {
      setErrorMsg("Failed to load students");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]);

  const allUniqueDivisions = useMemo(() => {
    const list = Object.values(DIVISIONS).flat();
    return Array.from(new Set(list));
  }, []);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">
            Manage student registrations and information
          </p>
          <Link href="/students/register">
            <Button className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Add Student
            </Button>
          </Link>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Student Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search students by name"
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
                    const nextClass = e.target.value;
                    setFilters((f) => ({
                      ...f,
                      class: nextClass,
                      division: "",
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
                  {allUniqueDivisions.map((d) => (
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
              <Input
                placeholder="Email"
                value={filters.email}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, email: e.target.value }))
                }
              />
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPage(1);
                    fetchStudents();
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
                      email: "",
                      name: "",
                    });
                    setPage(1);
                    fetchStudents();
                  }}
                >
                  Reset
                </Button>
              </div>
            </div>

            {/* List */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-2 pr-2">Photo</th>
                    <th className="py-2 pr-2">Student ID</th>
                    <th className="py-2 pr-2">Name</th>
                    <th className="py-2 pr-2">Email</th>
                    <th className="py-2 pr-2">Class</th>
                    <th className="py-2 pr-2">Division</th>
                    <th className="py-2 pr-2">Roll</th>
                  </tr>
                </thead>
                <tbody>
                  {(students || []).map((s) => (
                    <tr key={s._id} className="border-t">
                      <td className="py-2 pr-2">
                        <div className="w-10 h-10 rounded overflow-hidden bg-muted">
                          <img
                            src={getPicUrl((s.photos && s.photos[0]) || "")}
                            alt=""
                            className="w-10 h-10 object-cover"
                          />
                        </div>
                      </td>
                      <td className="py-2 pr-2">{s.studentId}</td>
                      <td className="py-2 pr-2">
                        {s.firstName} {s.lastName}
                      </td>
                      <td className="py-2 pr-2">{s.email}</td>
                      <td className="py-2 pr-2">{s.class}</td>
                      <td className="py-2 pr-2">{s.division}</td>
                      <td className="py-2 pr-2">{s.rollNumber}</td>
                    </tr>
                  ))}
                  {!students?.length && !loading && (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-6 text-center text-muted-foreground"
                      >
                        No students found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
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
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
