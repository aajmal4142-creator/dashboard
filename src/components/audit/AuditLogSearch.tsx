"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Search } from "lucide-react";
import { toast } from "sonner";

interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  entity_type: string;
  entity_id: string;
  actor: string;
  ip_address: string;
  changes_before: string;
  changes_after: string;
}

interface AuditLogSearchProps {
  onLogsLoad?: (logs: AuditLog[]) => void;
}

export function AuditLogSearch({ onLogsLoad }: AuditLogSearchProps) {
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.append("q", query);
      if (action) params.append("action", action);
      if (entityType) params.append("entityType", entityType);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const response = await fetch(`/api/app/audit-logs/search?${params}`);
      const data = await response.json();

      setLogs(data.logs || []);
      onLogsLoad?.(data.logs || []);
      toast.success(`Found ${(data.logs || []).length} audit logs`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to search logs";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: "csv" | "json") => {
    try {
      const params = new URLSearchParams();
      if (query) params.append("q", query);
      if (action) params.append("action", action);
      if (entityType) params.append("entityType", entityType);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      params.append("format", format);

      const response = await fetch(`/api/app/audit-logs/export?${params}`);

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`Exported ${logs.length} logs as ${format.toUpperCase()}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Export failed";
      toast.error(message);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Advanced Search</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Input
            placeholder="Search logs..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Actions</SelectItem>
              <SelectItem value="create">Create</SelectItem>
              <SelectItem value="update">Update</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
              <SelectItem value="approve">Approve</SelectItem>
              <SelectItem value="export">Export</SelectItem>
            </SelectContent>
          </Select>

          <Select value={entityType} onValueChange={setEntityType}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by resource" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Resources</SelectItem>
              <SelectItem value="suppliers">Suppliers</SelectItem>
              <SelectItem value="datapoints">Datapoints</SelectItem>
              <SelectItem value="reports">Reports</SelectItem>
              <SelectItem value="users">Users</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSearch} disabled={loading}>
            <Search className="mr-2 h-4 w-4" />
            {loading ? "Searching..." : "Search"}
          </Button>
          {logs.length > 0 && (
            <>
              <Button variant="outline" onClick={() => handleExport("csv")}>
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
              <Button variant="outline" onClick={() => handleExport("json")}>
                <Download className="mr-2 h-4 w-4" />
                JSON
              </Button>
            </>
          )}
        </div>
      </Card>

      {logs.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-4">Results ({logs.length})</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className="p-3 border rounded text-sm">
                <div className="flex justify-between mb-1">
                  <span className="font-medium">{log.action}</span>
                  <span className="text-gray-500 text-xs">{log.timestamp}</span>
                </div>
                <div className="text-gray-600">
                  {log.entity_type} / {log.entity_id} by {log.actor}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
