/**
 * Local QA helper: set organisations.plan + subscriptionStatus.
 * Usage: pnpm exec tsx scripts/set-org-plan.ts [orgId] [free|pro|consultant]
 */
import "dotenv/config";

import { getPayload } from "payload";

import config from "../src/payload.config";

const ORG_ID = process.argv[2] || "6a6110dabaea9eb9de9e3f7b";
const PLAN = (process.argv[3] || "consultant") as "free" | "pro" | "consultant";

if (!["free", "pro", "consultant"].includes(PLAN)) {
  console.error("Plan must be free | pro | consultant");
  process.exit(1);
}

async function main() {
  const payload = await getPayload({ config });

  const updated = await payload.update({
    collection: "organisations",
    id: ORG_ID,
    data: {
      plan: PLAN,
      subscriptionStatus: PLAN === "free" ? "none" : "active",
    },
    overrideAccess: true,
  });

  console.log(
    JSON.stringify(
      {
        id: updated.id,
        name: updated.name,
        plan: updated.plan,
        subscriptionStatus: updated.subscriptionStatus,
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
