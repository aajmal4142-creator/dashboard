import { redirect } from "next/navigation";
import { getPayload } from "payload";

import { TrustChecklistClient } from "@/app/(frontend)/(app)/trust/TrustChecklistClient";
import { PageFrame } from "@/components/shell/PageFrame";
import { getCurrentContext } from "@/lib/auth";
import { createTranslator } from "@/lib/i18n";
import {
  ATTESTATIONS,
  AUTH_MODEL,
  DATA_RESIDENCY,
  ENCRYPTION_NOTES,
  SECURITY_CONTROLS,
  SUBPROCESSORS,
} from "@/lib/trust";
import { loadTrustChecklistSnapshot } from "@/lib/trust/loadChecklist";
import config from "@/payload.config";

function attestationTone(status: (typeof ATTESTATIONS)[number]["status"]): string {
  if (status === "attested") return "text-signal";
  if (status === "in_progress") return "text-amber";
  return "text-ink-muted";
}

export default async function TrustPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");

  const t = createTranslator(ctx.user.language);

  let checklistInitial = null as
    | (Awaited<ReturnType<typeof loadTrustChecklistSnapshot>> & {
        canEdit: boolean;
      })
    | null;
  let checklistError: string | null = null;
  try {
    const payload = await getPayload({ config });
    const snapshot = await loadTrustChecklistSnapshot(payload, ctx.activeOrg.id);
    checklistInitial = {
      ...snapshot,
      canEdit: ctx.role === "owner" || ctx.role === "admin",
    };
  } catch {
    checklistError = t("trust.checklist.error");
  }

  return (
    <PageFrame
      eyebrow={t("trust.eyebrow")}
      title={t("trust.title")}
      help={t("trust.help")}
      rail={
        <div className="space-y-4 text-[13px] text-ink-muted">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              {t("trust.rail.honesty")}
            </p>
            <p className="mt-2 text-ink">{t("trust.rail.honestyBody")}</p>
          </div>
          <div className="border-t border-rule pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              {t("trust.rail.contact")}
            </p>
            <p className="mt-2">{t("trust.rail.contactBody")}</p>
          </div>
        </div>
      }
    >
      <div className="space-y-12">
        <section>
          <h2 className="font-display text-xl text-ink">
            {t("trust.attestations.title")}
          </h2>
          <div className="title-rule mt-2" />
          <p className="mt-3 max-w-[66ch] text-sm text-ink-muted">
            {t("trust.attestations.help")}
          </p>
          <ul className="mt-6 divide-y divide-rule border-t border-rule">
            {ATTESTATIONS.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 max-w-[66ch]">
                  <p className="text-[15px] font-semibold text-ink">{row.name}</p>
                  <p className="mt-1 text-[13px] text-ink-muted">{row.note}</p>
                </div>
                <span
                  className={`shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] ${attestationTone(row.status)}`}
                >
                  {t(`trust.attestations.statuses.${row.status}`)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl text-ink">{t("trust.controls.title")}</h2>
          <div className="title-rule mt-2" />
          <p className="mt-3 max-w-[66ch] text-sm text-ink-muted">
            {t("trust.controls.help")}
          </p>
          <ul className="mt-6 divide-y divide-rule border-t border-rule">
            {SECURITY_CONTROLS.map((control) => (
              <li key={control.id} className="py-4">
                <p className="text-[15px] font-semibold text-ink">{control.title}</p>
                <p className="mt-1 max-w-[66ch] text-[13px] text-ink-muted">
                  {control.summary}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl text-ink">{t("trust.auth.title")}</h2>
          <div className="title-rule mt-2" />
          <dl className="mt-6 grid gap-4 border-t border-rule pt-4 sm:grid-cols-2">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                {t("trust.auth.identity")}
              </dt>
              <dd className="mt-1 font-data text-[14px] text-ink">
                {AUTH_MODEL.identity}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                {t("trust.auth.authorisation")}
              </dt>
              <dd className="mt-1 font-data text-[14px] text-ink">
                {AUTH_MODEL.authorisation}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                {t("trust.auth.principle")}
              </dt>
              <dd className="mt-1 text-[14px] text-ink">{AUTH_MODEL.principle}</dd>
              <p className="mt-2 max-w-[66ch] text-[13px] text-ink-muted">
                {AUTH_MODEL.summary}
              </p>
            </div>
          </dl>
        </section>

        <section>
          <h2 className="font-display text-xl text-ink">{t("trust.encryption.title")}</h2>
          <div className="title-rule mt-2" />
          <dl className="mt-6 space-y-4 border-t border-rule pt-4">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                {t("trust.encryption.transit")}
              </dt>
              <dd className="mt-1 max-w-[66ch] text-[13px] text-ink-muted">
                {ENCRYPTION_NOTES.transit}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                {t("trust.encryption.rest")}
              </dt>
              <dd className="mt-1 max-w-[66ch] text-[13px] text-ink-muted">
                {ENCRYPTION_NOTES.rest}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                {t("trust.encryption.keys")}
              </dt>
              <dd className="mt-1 max-w-[66ch] text-[13px] text-ink-muted">
                {ENCRYPTION_NOTES.keys}
              </dd>
            </div>
          </dl>
        </section>

        <section>
          <h2 className="font-display text-xl text-ink">{t("trust.residency.title")}</h2>
          <div className="title-rule mt-2" />
          <p className="mt-3 max-w-[66ch] text-sm text-ink-muted">
            {DATA_RESIDENCY.note}
          </p>
          <p className="mt-3 max-w-[66ch] text-[13px] text-amber">
            {DATA_RESIDENCY.openDecision}
          </p>
          <p className="mt-4 font-data text-[13px] text-ink">
            {t("trust.residency.store")}: {DATA_RESIDENCY.primaryStore}
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-ink">
            {t("trust.subprocessors.title")}
          </h2>
          <div className="title-rule mt-2" />
          <p className="mt-3 max-w-[66ch] text-sm text-ink-muted">
            {t("trust.subprocessors.help")}
          </p>
          <div className="mt-6 overflow-x-auto border-t border-rule">
            <table className="w-full min-w-[40rem] text-left text-[13px]">
              <thead>
                <tr className="border-b border-rule text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  <th className="py-3 pr-4 font-semibold">
                    {t("trust.subprocessors.cols.name")}
                  </th>
                  <th className="py-3 pr-4 font-semibold">
                    {t("trust.subprocessors.cols.purpose")}
                  </th>
                  <th className="py-3 pr-4 font-semibold">
                    {t("trust.subprocessors.cols.data")}
                  </th>
                  <th className="py-3 font-semibold">
                    {t("trust.subprocessors.cols.region")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {SUBPROCESSORS.map((row) => (
                  <tr key={row.id}>
                    <td className="py-3 pr-4 align-top">
                      {row.website ? (
                        <a
                          href={row.website}
                          className="editorial-link text-accent"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {row.name}
                        </a>
                      ) : (
                        <span className="text-ink">{row.name}</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 align-top text-ink-muted">{row.purpose}</td>
                    <td className="py-3 pr-4 align-top text-ink-muted">
                      {row.dataCategories}
                    </td>
                    <td className="py-3 align-top font-data text-ink">{row.region}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl text-ink">{t("trust.checklist.title")}</h2>
          <div className="title-rule mt-2" />
          <p className="mt-3 max-w-[66ch] text-sm text-ink-muted">
            {t("trust.checklist.help")}
          </p>
          <div className="mt-6">
            <TrustChecklistClient
              initial={checklistInitial}
              initialError={checklistError}
            />
          </div>
        </section>
      </div>
    </PageFrame>
  );
}
