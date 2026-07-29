import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const ERP_CONNECTIONS_SLUG = "erp-connections" as const;

export const ERPConnections: CollectionConfig = {
  slug: ERP_CONNECTIONS_SLUG,
  admin: {
    useAsTitle: "connectionName",
    defaultColumns: ["connectionName", "erpType", "status", "lastSyncedAt"],
  },
  access: tenantAccess({ writeMin: "admin" }),
  fields: [
    {
      name: "organisation",
      type: "relationship",
      relationTo: "organisations",
      required: true,
      index: true,
    },
    {
      name: "connectionName",
      type: "text",
      required: true,
      admin: { description: "Human-readable connection name" },
    },
    {
      name: "erpType",
      type: "select",
      required: true,
      options: [
        { label: "NetSuite", value: "netsuite" },
        { label: "SAP", value: "sap" },
        { label: "Xero", value: "xero" },
        { label: "QuickBooks", value: "quickbooks" },
        { label: "Workday", value: "workday" },
        { label: "Oracle Fusion", value: "oracle" },
        { label: "Microsoft Dynamics 365", value: "d365" },
      ],
      index: true,
    },
    {
      name: "status",
      type: "select",
      defaultValue: "disconnected",
      options: [
        { label: "Connected", value: "connected" },
        { label: "Disconnected", value: "disconnected" },
        { label: "Syncing", value: "syncing" },
        { label: "Error", value: "error" },
        { label: "Paused", value: "paused" },
      ],
      index: true,
    },
    {
      name: "apiEndpoint",
      type: "text",
      required: true,
      admin: { description: "ERP API endpoint URL" },
    },
    {
      name: "credentials",
      type: "json",
      required: true,
      admin: { description: "OAuth/API credentials (encrypted at rest)" },
    },
    {
      name: "syncSchedule",
      type: "select",
      defaultValue: "hourly",
      options: [
        { label: "Manual", value: "manual" },
        { label: "Hourly", value: "hourly" },
        { label: "Daily", value: "daily" },
        { label: "Weekly", value: "weekly" },
      ],
    },
    {
      name: "cdcEnabled",
      type: "checkbox",
      defaultValue: false,
      admin: { description: "Enable Change Data Capture for real-time sync" },
    },
    {
      name: "lastSyncedAt",
      type: "date",
      admin: { description: "Last successful data sync" },
    },
    {
      name: "nextSyncAt",
      type: "date",
      admin: { description: "Next scheduled sync" },
    },
    {
      name: "fieldMapping",
      type: "json",
      admin: { description: "Custom field mapping (GL account -> emissions category)" },
    },
    {
      name: "dataEntities",
      type: "array",
      admin: { description: "ERP data entities to sync" },
      fields: [
        {
          name: "entityType",
          type: "select",
          required: true,
          options: [
            { label: "Chart of Accounts", value: "accounts" },
            { label: "Cost Centers", value: "cost_centers" },
            { label: "Vendors", value: "vendors" },
            { label: "Purchase Orders", value: "purchase_orders" },
            { label: "Invoices", value: "invoices" },
            { label: "Employees", value: "employees" },
          ],
        },
        {
          name: "enabled",
          type: "checkbox",
          defaultValue: true,
        },
      ],
    },
    {
      name: "syncErrors",
      type: "array",
      fields: [
        {
          name: "timestamp",
          type: "date",
          required: true,
        },
        {
          name: "errorMessage",
          type: "text",
        },
        {
          name: "failedRecords",
          type: "number",
        },
      ],
    },
    {
      name: "reconciliationStatus",
      type: "select",
      defaultValue: "pending",
      options: [
        { label: "Pending", value: "pending" },
        { label: "In Progress", value: "in_progress" },
        { label: "Reconciled", value: "reconciled" },
        { label: "Failed", value: "failed" },
      ],
    },
  ],
};
