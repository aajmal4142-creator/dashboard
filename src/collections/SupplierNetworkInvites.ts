import type { CollectionConfig } from "payload";

import { tenantAccess } from "@/lib/access";

export const SUPPLIER_NETWORK_INVITES_SLUG = "supplier-network-invites" as const;

/**
 * Peer-to-peer carbon network invites (F30).
 * Buyer invites a supplier email; accept binds an authenticated supplier org.
 * Not a rating agency or paid network.
 */
export const SupplierNetworkInvites: CollectionConfig = {
  slug: SUPPLIER_NETWORK_INVITES_SLUG,
  admin: {
    useAsTitle: "inviteEmail",
    defaultColumns: [
      "inviteEmail",
      "status",
      "organisation",
      "supplierOrganisation",
      "expiresAt",
      "updatedAt",
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
      admin: {
        description: "Buyer organisation that sent the invite",
        hidden: true,
      },
    },
    {
      name: "inviteEmail",
      type: "email",
      required: true,
      index: true,
      admin: {
        description:
          "Supplier contact email. Accept requires Membership with this email.",
      },
    },
    {
      name: "token",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: {
        description: "Opaque invite token — never embeds organisation id",
      },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "pending",
      index: true,
      options: [
        { label: "Pending", value: "pending" },
        { label: "Accepted", value: "accepted" },
        { label: "Declined", value: "declined" },
        { label: "Revoked", value: "revoked" },
      ],
    },
    {
      name: "supplierOrganisation",
      type: "relationship",
      relationTo: "organisations",
      index: true,
      admin: {
        description: "Bound when the invite is accepted by a supplier org",
      },
    },
    {
      name: "supplierDisplayName",
      type: "text",
      admin: {
        description: "Optional label the buyer uses for this supplier",
      },
    },
    {
      name: "message",
      type: "textarea",
      admin: {
        description: "Optional note shown to the supplier with the invite",
      },
    },
    {
      name: "invitedBy",
      type: "relationship",
      relationTo: "users",
    },
    {
      name: "expiresAt",
      type: "date",
      required: true,
      index: true,
    },
    { name: "acceptedAt", type: "date" },
    { name: "declinedAt", type: "date" },
    { name: "revokedAt", type: "date" },
  ],
  timestamps: true,
};
