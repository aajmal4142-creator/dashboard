import type { CollectionConfig } from "payload";
import { tenantAccess } from "@/lib/access";

export const Scope3Sources: CollectionConfig = {
  slug: "scope3-sources",
  admin: {
    useAsTitle: "name",
    defaultColumns: [
      "name",
      "type",
      "organisation",
      "emissionsFactor.value",
      "createdAt",
    ],
  },
  access: tenantAccess({ writeMin: "contributor", adminWriteMin: "admin" }),
  fields: [
    {
      name: "organisation",
      type: "relationship",
      relationTo: "organisations",
      required: true,
      index: true,
    },
    {
      name: "type",
      type: "select",
      required: true,
      options: [
        { label: "Supplier", value: "supplier" },
        { label: "Investment", value: "investment" },
        { label: "Waste", value: "waste" },
        { label: "Business Travel", value: "business_travel" },
        { label: "Employee Commute", value: "employee_commute" },
      ],
    },
    {
      name: "name",
      type: "text",
      required: true,
    },
    {
      name: "description",
      type: "richText",
    },
    {
      name: "emissionsFactor",
      type: "json",
      required: true,
      admin: {
        description:
          "Emissions factor: value (number), unit (string), source (DEFRA/IPCC/CDP/Custom), year (number), confidence (high/medium/low)",
      },
    },
    {
      name: "activityDataFields",
      type: "json",
      required: true,
      admin: {
        description:
          "Array of activity fields: name (string), unit (string), description (string), required (boolean)",
      },
    },
  ],
};
