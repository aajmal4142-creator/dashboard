import type { Payload } from "payload";
import { DEFAULT_ROLES } from "./defaultRoles";

/**
 * Seed default policy roles.
 * Call this on app startup or in a migration.
 */

export async function seedDefaultRoles(payload: Payload) {
  try {
    // Check if roles already exist
    const existing = await payload.find({
      collection: "policy-roles",
      where: {
        name: { in: DEFAULT_ROLES.map((r) => r.name) },
      },
    });

    if (existing.docs.length === DEFAULT_ROLES.length) {
      console.log("Default policy roles already seeded");
      return;
    }

    // Seed missing roles
    for (const role of DEFAULT_ROLES) {
      const exists = existing.docs.some((doc) => {
        const docName =
          typeof doc === "object" && doc !== null && "name" in doc
            ? (doc as Record<string, unknown>).name
            : undefined;
        return docName === role.name;
      });
      if (!exists) {
        await payload.create({
          collection: "policy-roles",
          data: {
            name: role.name,
            description: role.description,
            defaultCapabilities: role.defaultCapabilities,
            isSystem: role.isSystem,
          },
        });

        console.log(`✓ Seeded role: ${role.name}`);
      }
    }
  } catch (error) {
    console.error("Failed to seed default roles:", error);
  }
}
