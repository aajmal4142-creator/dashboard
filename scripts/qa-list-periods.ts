import "dotenv/config";

import { writeFileSync } from "fs";
import { getPayload } from "payload";

import config from "../src/payload.config";

async function main() {
  const payload = await getPayload({ config });
  const periods = await payload.find({
    collection: "reporting-periods",
    where: { organisation: { equals: "6a6110dabaea9eb9de9e3f7b" } },
    sort: "-startDate",
    limit: 20,
    overrideAccess: true,
  });
  const rows = periods.docs.map((p) => ({
    id: p.id,
    label: p.label,
    startDate: p.startDate,
    endDate: p.endDate,
    startY: new Date(String(p.startDate)).getFullYear(),
    endY: new Date(String(p.endDate)).getFullYear(),
  }));
  const dps = await payload.find({
    collection: "datapoints",
    where: { organisation: { equals: "6a6110dabaea9eb9de9e3f7b" } },
    limit: 5,
    overrideAccess: true,
  });
  const out = {
    rows,
    datapoints: dps.totalDocs,
    sample: dps.docs.map((d) => ({
      id: d.id,
      metricKey: d.metricKey,
      value: d.value,
      period: d.period,
    })),
  };
  writeFileSync("qa-periods.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
