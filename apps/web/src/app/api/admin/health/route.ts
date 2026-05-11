import { NextResponse } from "next/server";
import { collectInstanceHealth, connectMongo, listCookieAccounts } from "@wave/shared";
import { checkAdmin } from "@/lib/admin-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Detailed pool + instance health, JSON-only. Useful as a scrape target for
 * uptime monitoring or to drive an external dashboard.
 *
 * Auth: admin only (the same admin gate as the `/admin` pages).
 */
export async function GET() {
  const check = await checkAdmin();
  if (check.status !== "ok") {
    const status = check.status === "unauthenticated" ? 401 : 403;
    return NextResponse.json({ error: check.status }, { status });
  }
  await connectMongo();

  const [instances, cookies] = await Promise.all([
    collectInstanceHealth(),
    listCookieAccounts(),
  ]);

  const cookieSummary = {
    total: cookies.length,
    enabled: cookies.filter((c) => !c.disabled).length,
    disabled: cookies.filter((c) => c.disabled && !c.autoDisabled).length,
    autoDisabled: cookies.filter((c) => c.autoDisabled).length,
    totalRotations: cookies.reduce((acc, c) => acc + (c.rotationCount ?? 0), 0),
    accounts: cookies.map((c) => ({
      id: c.id,
      label: c.label,
      disabled: c.disabled,
      autoDisabled: c.autoDisabled,
      autoDisabledAt: c.autoDisabledAt,
      disabledReason: c.disabledReason,
      lastUsedAt: c.lastUsedAt,
      usageCount: c.usageCount,
      rotationCount: c.rotationCount,
    })),
  };

  return NextResponse.json(
    {
      ok: true,
      generatedAt: new Date().toISOString(),
      instances,
      cookies: cookieSummary,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
