"use client";

import { useEffect, useState } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  AlertCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Deadline {
  id: string;
  name: string;
  description?: string;
  jurisdiction: string;
  framework: string;
  dueDate: string;
  status: string;
  colour: string;
}

interface CalendarDay {
  date: string;
  deadlines: Deadline[];
  isToday: boolean;
  isOverdue: boolean;
}

interface CalendarData {
  year: number;
  month: number;
  days: CalendarDay[];
}

interface Summary {
  total: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  submitted: number;
  verified: number;
  overdue: number;
  dueInNext7Days: number;
  dueInNext30Days: number;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const JURISDICTIONS = ["EU", "IN", "GB", "US", "GLOBAL", "OTHER"];
const FRAMEWORKS = ["CSRD", "BRSR", "GRI", "SASB", "TCFD", "ISO14064", "OTHER"];
const STATUSES = [
  "not_started",
  "in_progress",
  "completed",
  "submitted",
  "verified",
  "overdue",
];

function getStatusIcon(status: string) {
  switch (status) {
    case "verified":
    case "submitted":
      return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    case "completed":
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case "in_progress":
      return <Clock className="w-4 h-4 text-yellow-600" />;
    case "overdue":
      return <AlertTriangle className="w-4 h-4 text-red-600" />;
    default:
      return <AlertCircle className="w-4 h-4 text-gray-400" />;
  }
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    not_started: "Not Started",
    in_progress: "In Progress",
    completed: "Completed",
    submitted: "Submitted",
    verified: "Verified",
    overdue: "Overdue",
  };
  return labels[status] || status;
}

function getColorClass(colour: string): string {
  switch (colour) {
    case "green":
      return "bg-green-100 text-green-800 border-green-300";
    case "yellow":
      return "bg-yellow-100 text-yellow-800 border-yellow-300";
    case "red":
      return "bg-red-100 text-red-800 border-red-300";
    case "blue":
      return "bg-blue-100 text-blue-800 border-blue-300";
    default:
      return "bg-gray-100 text-gray-800 border-gray-300";
  }
}

export function CalendarClient() {
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [listDeadlines, setListDeadlines] = useState<Deadline[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Filters
  const [jurisdiction, setJurisdiction] = useState<string>("");
  const [framework, setFramework] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [listView, setListView] = useState<"upcoming" | "overdue" | "all">("upcoming");

  // Fetch calendar data
  useEffect(() => {
    async function loadCalendarData() {
      try {
        const params = new URLSearchParams({
          view: "calendar",
          year: String(currentDate.getFullYear()),
          month: String(currentDate.getMonth()),
        });
        const response = await fetch(`/api/app/compliance/calendar?${params}`);
        if (!response.ok) throw new Error("Failed to load calendar");
        const data = await response.json();
        setCalendarData(data);
      } catch (err) {
        console.error(err);
      }
    }

    loadCalendarData();
  }, [currentDate, view]);

  // Fetch list view
  useEffect(() => {
    async function loadListData() {
      try {
        const params = new URLSearchParams({
          view: "list",
          listView,
        });
        if (jurisdiction) params.append("jurisdiction", jurisdiction);
        if (framework) params.append("framework", framework);
        if (status) params.append("status", status);
        if (search) params.append("search", search);

        const response = await fetch(`/api/app/compliance/calendar?${params}`);
        if (!response.ok) throw new Error("Failed to load deadlines");
        const data = await response.json();
        setListDeadlines(data.deadlines || []);
      } catch (err) {
        console.error(err);
      }
    }

    if (view === "list") {
      loadListData();
    }
  }, [view, jurisdiction, framework, status, search, listView]);

  // Fetch summary
  useEffect(() => {
    async function loadSummary() {
      try {
        const response = await fetch(`/api/app/compliance/calendar?view=summary`);
        if (!response.ok) throw new Error("Failed to load summary");
        const data = await response.json();
        setSummary(data);
      } catch (err) {
        console.error(err);
      }
    }

    loadSummary();
  }, []);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const handleExport = async () => {
    try {
      const response = await fetch("/api/app/compliance/calendar/export");
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `deadlines-${new Date().toISOString().split("T")[0]}.ics`;
      a.click();
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Deadlines
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Due in 7 days
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {summary.dueInNext7Days}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Overdue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{summary.overdue}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Verified
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{summary.verified}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={view === "calendar" ? "default" : "outline"}
            onClick={() => setView("calendar")}
            className="gap-2"
          >
            <Calendar className="w-4 h-4" />
            Calendar
          </Button>
          <Button
            variant={view === "list" ? "default" : "outline"}
            onClick={() => setView("list")}
          >
            List
          </Button>
        </div>

        <Button onClick={handleExport} variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Export iCal
        </Button>
      </div>

      {/* Calendar View */}
      {view === "calendar" && calendarData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
              </CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handlePrevMonth}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={handleNextMonth}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                      <th
                        key={day}
                        className="text-center p-2 font-medium text-muted-foreground"
                      >
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Generate calendar grid */}
                  {(() => {
                    const firstDay = new Date(
                      currentDate.getFullYear(),
                      currentDate.getMonth(),
                      1,
                    ).getDay();
                    const rows: Array<Array<(CalendarDay & { dayNum: number }) | null>> =
                      [];
                    let currentRow: Array<(CalendarDay & { dayNum: number }) | null> = [];

                    // Empty cells before first day
                    for (let i = 0; i < firstDay; i++) {
                      currentRow.push(null);
                    }

                    // Calendar days
                    for (const day of calendarData.days) {
                      const dayNum = parseInt(day.date.split("-")[2]);
                      currentRow.push({ ...day, dayNum });

                      if (currentRow.length === 7) {
                        rows.push(currentRow);
                        currentRow = [];
                      }
                    }

                    // Fill remaining cells
                    while (currentRow.length > 0 && currentRow.length < 7) {
                      currentRow.push(null);
                    }
                    if (currentRow.length === 7) {
                      rows.push(currentRow);
                    }

                    return rows.map((row, idx) => (
                      <tr key={idx}>
                        {row.map((day, cellIdx: number) => (
                          <td
                            key={cellIdx}
                            className={`border p-2 min-h-24 align-top ${
                              day
                                ? day.isToday
                                  ? "bg-blue-50"
                                  : day.isOverdue && day.deadlines.length === 0
                                    ? "bg-gray-50"
                                    : ""
                                : "bg-gray-50"
                            }`}
                          >
                            {day && (
                              <div className="space-y-1">
                                <div className="font-medium">{day.dayNum}</div>
                                <div className="space-y-1">
                                  {day.deadlines.map((deadline) => (
                                    <div
                                      key={deadline.id}
                                      className={`text-xs p-1 rounded border ${getColorClass(
                                        deadline.colour,
                                      )}`}
                                      title={deadline.name}
                                    >
                                      {deadline.name.substring(0, 15)}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </td>
                        ))}
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List View */}
      {view === "list" && (
        <div className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="relative">
                  <Search className="absolute left-2 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search deadlines..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>

                <Select
                  value={listView}
                  onValueChange={(v) => setListView(v as "upcoming" | "overdue" | "all")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="View" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={jurisdiction} onValueChange={setJurisdiction}>
                  <SelectTrigger>
                    <SelectValue placeholder="Jurisdiction" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    {JURISDICTIONS.map((j) => (
                      <SelectItem key={j} value={j}>
                        {j}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={framework} onValueChange={setFramework}>
                  <SelectTrigger>
                    <SelectValue placeholder="Framework" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    {FRAMEWORKS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {getStatusLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Deadlines List */}
          <Card>
            <CardContent className="p-0">
              {listDeadlines.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No deadlines found
                </div>
              ) : (
                <div className="divide-y">
                  {listDeadlines.map((deadline) => (
                    <div
                      key={deadline.id}
                      className="p-4 flex items-start justify-between hover:bg-gray-50"
                    >
                      <div className="flex items-start gap-3 flex-1">
                        <div className="mt-1">{getStatusIcon(deadline.status)}</div>
                        <div className="flex-1">
                          <h3 className="font-medium">{deadline.name}</h3>
                          {deadline.description && (
                            <p className="text-sm text-muted-foreground">
                              {deadline.description}
                            </p>
                          )}
                          <div className="flex gap-2 mt-2">
                            <Badge variant="outline">{deadline.framework}</Badge>
                            <Badge variant="outline">{deadline.jurisdiction}</Badge>
                            <Badge className={getColorClass(deadline.colour)}>
                              {getStatusLabel(deadline.status)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="font-medium">
                          {new Date(deadline.dueDate).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {Math.ceil(
                            (new Date(deadline.dueDate).getTime() -
                              new Date().getTime()) /
                              (1000 * 60 * 60 * 24),
                          )}{" "}
                          days
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
