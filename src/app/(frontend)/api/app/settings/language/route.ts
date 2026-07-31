import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getApiContext } from "@/lib/auth/apiContext";
import { LOCALE_OPTIONS, isSupportedLocale, resolveLocale } from "@/lib/i18n";
import config from "@/payload.config";

/**
 * GET /api/app/settings/language — current user language preference + options.
 */
export async function GET() {
  const result = await getApiContext();
  if (!result.ok) return result.response;

  const payload = await getPayload({ config });
  const user = await payload.findByID({
    collection: "users",
    id: result.ctx.user.id,
    overrideAccess: true,
  });

  const language = resolveLocale(
    user && "language" in user ? user.language : result.ctx.user.language,
  );

  return NextResponse.json({
    language,
    options: LOCALE_OPTIONS.map((o) => o.value),
  });
}

/**
 * PUT /api/app/settings/language — persist UI language on the Users row.
 * Body: `{ language: "en" | "hi" }`.
 */
export async function PUT(req: Request) {
  const result = await getApiContext();
  if (!result.ok) return result.response;

  const body = (await req.json().catch(() => null)) as {
    language?: unknown;
  } | null;
  if (!body || !isSupportedLocale(body.language)) {
    return NextResponse.json(
      { error: "Unsupported language. Supported: en, hi." },
      { status: 400 },
    );
  }

  const language = body.language;
  const payload = await getPayload({ config });
  await payload.update({
    collection: "users",
    id: result.ctx.user.id,
    data: { language },
    overrideAccess: true,
  });

  return NextResponse.json({ language });
}
