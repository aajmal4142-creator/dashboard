import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const EMAIL_DATA_COLLECTION_FORMS_SLUG = "email-data-collection-forms" as const;

export const EmailDataCollectionForms: CollectionConfig = {
  slug: EMAIL_DATA_COLLECTION_FORMS_SLUG,
  admin: {
    useAsTitle: "formName",
    defaultColumns: ["formName", "status", "recipientCount", "responseRate"],
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
      name: "formName",
      type: "text",
      required: true,
      admin: { description: "Name of this email collection form" },
    },
    {
      name: "description",
      type: "textarea",
      admin: { description: "Form description for internal tracking" },
    },
    {
      name: "formType",
      type: "select",
      required: true,
      options: [
        { label: "Supplier Questionnaire", value: "supplier_questionnaire" },
        { label: "Emissions Data Request", value: "emissions_data" },
        { label: "Product Data Request", value: "product_data" },
        { label: "Custom", value: "custom" },
      ],
    },
    {
      name: "status",
      type: "select",
      defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Active", value: "active" },
        { label: "Closed", value: "closed" },
        { label: "Archived", value: "archived" },
      ],
      index: true,
    },
    {
      name: "emailSubject",
      type: "text",
      required: true,
      admin: { description: "Subject line for the email" },
    },
    {
      name: "emailBody",
      type: "textarea",
      required: true,
      admin: {
        description: "Email body text (supports variables: {{company}}, {{deadline}})",
      },
    },
    {
      name: "fields",
      type: "array",
      required: true,
      admin: { description: "Form fields to extract data from responses" },
      fields: [
        {
          name: "fieldName",
          type: "text",
          required: true,
          admin: { description: "Field identifier (e.g., energy_consumption)" },
        },
        {
          name: "fieldLabel",
          type: "text",
          required: true,
          admin: { description: "Display label in email" },
        },
        {
          name: "fieldType",
          type: "select",
          required: true,
          options: [
            { label: "Text", value: "text" },
            { label: "Number", value: "number" },
            { label: "Date", value: "date" },
            { label: "Dropdown", value: "select" },
            { label: "Checkbox", value: "checkbox" },
            { label: "File Upload", value: "file" },
          ],
        },
        {
          name: "required",
          type: "checkbox",
          defaultValue: false,
        },
        {
          name: "options",
          type: "array",
          admin: { description: "Options for select/checkbox fields" },
          fields: [
            {
              name: "label",
              type: "text",
            },
            {
              name: "value",
              type: "text",
            },
          ],
        },
        {
          name: "parseRule",
          type: "text",
          admin: { description: "Regex or parser rule for data extraction" },
        },
      ],
    },
    {
      name: "template",
      type: "select",
      options: [
        { label: "Structured Form", value: "structured" },
        { label: "Freeform", value: "freeform" },
        { label: "Attachment Only", value: "attachment" },
      ],
      defaultValue: "structured",
    },
    {
      name: "recipients",
      type: "array",
      admin: { description: "Email addresses to send forms to" },
      fields: [
        {
          name: "email",
          type: "email",
          required: true,
        },
        {
          name: "name",
          type: "text",
        },
        {
          name: "company",
          type: "text",
        },
        {
          name: "status",
          type: "select",
          options: [
            { label: "Pending", value: "pending" },
            { label: "Sent", value: "sent" },
            { label: "Opened", value: "opened" },
            { label: "Responded", value: "responded" },
            { label: "Failed", value: "failed" },
          ],
          defaultValue: "pending",
        },
        {
          name: "sentAt",
          type: "date",
        },
        {
          name: "openedAt",
          type: "date",
        },
        {
          name: "responseReceivedAt",
          type: "date",
        },
      ],
    },
    {
      name: "responses",
      type: "array",
      admin: { description: "Collected responses" },
      fields: [
        {
          name: "recipientEmail",
          type: "email",
          required: true,
        },
        {
          name: "receivedAt",
          type: "date",
          required: true,
        },
        {
          name: "rawMessage",
          type: "textarea",
          admin: { description: "Raw email body" },
        },
        {
          name: "parsedData",
          type: "json",
          admin: { description: "Extracted structured data" },
        },
        {
          name: "attachments",
          type: "array",
          fields: [
            {
              name: "file",
              type: "relationship",
              relationTo: "media",
            },
            {
              name: "extractedData",
              type: "json",
              admin: { description: "Data extracted from attachment" },
            },
          ],
        },
        {
          name: "status",
          type: "select",
          options: [
            { label: "New", value: "new" },
            { label: "Reviewed", value: "reviewed" },
            { label: "Imported", value: "imported" },
            { label: "Rejected", value: "rejected" },
          ],
          defaultValue: "new",
        },
        {
          name: "qualityScore",
          type: "number",
          min: 0,
          max: 100,
          admin: { description: "Data quality assessment (0-100)" },
        },
      ],
    },
    {
      name: "deadlineDate",
      type: "date",
      admin: { description: "Response deadline (displayed in email)" },
    },
    {
      name: "reminderSchedule",
      type: "select",
      options: [
        { label: "No Reminders", value: "none" },
        { label: "1 Reminder", value: "one" },
        { label: "2 Reminders", value: "two" },
        { label: "Weekly", value: "weekly" },
      ],
      defaultValue: "one",
    },
    {
      name: "recipientCount",
      type: "number",
      defaultValue: 0,
      admin: { description: "Total recipients" },
    },
    {
      name: "responseCount",
      type: "number",
      defaultValue: 0,
      admin: { description: "Number of responses received" },
    },
    {
      name: "responseRate",
      type: "number",
      defaultValue: 0,
      admin: { description: "Response rate percentage (0-100)" },
    },
    {
      name: "dataQualityMetrics",
      type: "json",
      admin: { description: "Aggregated quality metrics for responses" },
    },
    {
      name: "inboundEnabled",
      type: "checkbox",
      defaultValue: false,
      index: true,
      admin: {
        description:
          "When enabled, whitelisted senders may email CSV attachments for ingest",
      },
    },
    {
      name: "inboundToken",
      type: "text",
      unique: true,
      index: true,
      admin: {
        description:
          "Match token in To address (import+TOKEN@…) or subject [ClearESG:TOKEN]",
      },
    },
    {
      name: "whitelistedSenders",
      type: "array",
      admin: {
        description:
          "Only these email addresses may submit inbound CSVs (non-whitelisted rejected)",
      },
      fields: [
        {
          name: "email",
          type: "email",
          required: true,
        },
        {
          name: "label",
          type: "text",
          admin: { description: "Optional display label" },
        },
      ],
    },
    {
      name: "recurringEnabled",
      type: "checkbox",
      defaultValue: false,
      admin: {
        description: "Allow repeated CSV imports over time (do not treat as one-shot)",
      },
    },
    {
      name: "recurringCadence",
      type: "select",
      defaultValue: "none",
      options: [
        { label: "None", value: "none" },
        { label: "Weekly", value: "weekly" },
        { label: "Monthly", value: "monthly" },
        { label: "Quarterly", value: "quarterly" },
      ],
      admin: { description: "Expected cadence for recurring imports (advisory)" },
    },
    {
      name: "lastImportAt",
      type: "date",
      admin: { description: "Timestamp of last successful inbound CSV import" },
    },
    {
      name: "createdBy",
      type: "relationship",
      relationTo: "users",
    },
  ],
};
