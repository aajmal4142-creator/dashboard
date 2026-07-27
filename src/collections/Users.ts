import type { CollectionConfig } from "payload";

/**
 * Identity mirror. Clerk is source of truth (Phase 2).
 * Local auth stays enabled through Phase 1 so /admin and access tests work;
 * Phase 2 disables it and relies on clerkId.
 */
export const Users: CollectionConfig = {
  slug: "users",
  admin: {
    useAsTitle: "email",
    defaultColumns: ["email", "firstName", "lastName", "clerkId"],
  },
  auth: true,
  fields: [
    {
      name: "clerkId",
      type: "text",
      unique: true,
      index: true,
      admin: {
        description: "Clerk user id — set by webhook in Phase 2",
      },
    },
    { name: "firstName", type: "text" },
    { name: "lastName", type: "text" },
    { name: "avatarUrl", type: "text" },
    { name: "lastSeenAt", type: "date" },
  ],
};
