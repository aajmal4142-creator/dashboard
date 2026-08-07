/**
 * Local QA helper: set organisations.plan + subscriptionStatus.
 * Usage: pnpm exec tsx scripts/set-org-plan.ts [orgId] [free|pro|professional|consultant|enterprise]
 */
import "dotenv/config";

import { getPayload } from "payload";

import config from "../src/payload.config";

const ORG_ID = process.argv[2] || "6a6110dabaea9eb9de9e3f7b";
const PLAN = process.argv[3] || "consultant";
const ALLOWED = ["free", "pro", "professional", "consultant", "enterprise"] as const;

if (!(ALLOWED as readonly string[]).includes(PLAN)) {
  console.error("Plan must be free | pro | professional | consultant | enterprise");
  process.exit(1);
}

async function main() {
  const payload = await getPayload({ config });

  const updated = await payload.update({
    collection: "organisations",
    id: ORG_ID,
    data: {
      plan: PLAN as (typeof ALLOWED)[number],
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
