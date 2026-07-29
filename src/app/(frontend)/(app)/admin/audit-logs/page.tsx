"use client";

import { PageFrame } from "@/components/shell/PageFrame";
import { AuditLogSearch } from "@/components/audit/AuditLogSearch";

export default function AuditLogsPage() {
  return (
    <PageFrame
      eyebrow="Admin"
      title="Audit Logs"
      help="Search, filter, and export audit logs for compliance and monitoring"
    >
      <AuditLogSearch />
    </PageFrame>
  );
}
