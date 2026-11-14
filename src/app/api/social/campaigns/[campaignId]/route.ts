import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const statuses = new Set(["draft", "planned", "active", "paused", "completed", "archived"]);
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const list = (v: unknown, max: number, itemMax: number) =>
  Array.isArray(v)
    ? [
        ...new Set(
          v
            .filter((x): x is string => typeof x === "string")
            .map((x) => x.trim().slice(0, itemMax))
            .filter(Boolean),
        ),
      ].slice(0, max)
    : [];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const { campaignId } = await params;
  if (!uuid.test(campaignId))
    return NextResponse.json({ error: "Invalid campaign." }, { status: 400 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (raw.length > 16000)
    return NextResponse.json({ error: "Campaign details are too large." }, { status: 413 });
  let input: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    input = parsed;
  } catch {
    return NextResponse.json({ error: "A valid JSON body is required." }, { status: 400 });
  }
  const status = text(input.status, 16);
  if (!statuses.has(status))
    return NextResponse.json({ error: "Select a valid campaign status." }, { status: 400 });
  const startDate = text(input.startDate, 10),
    endDate = text(input.endDate, 10);
  if (
    (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) ||
    (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) ||
    (startDate && endDate && endDate < startDate)
  )
    return NextResponse.json({ error: "Campaign date range is invalid." }, { status: 400 });
  const metrics = Array.isArray(input.successMetrics)
    ? input.successMetrics
        .slice(0, 10)
        .map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return null;
          const m = item as Record<string, unknown>;
          return { name: text(m.name, 80), target: text(m.target, 80), unit: text(m.unit, 30) };
        })
        .filter((m): m is { name: string; target: string; unit: string } => Boolean(m?.name))
    : [];
  const { data, error } = await supabase.rpc("update_social_campaign", {
    p_campaign_id: campaignId,
    p_payload: {
      name: text(input.name, 160),
      description: text(input.description, 3000),
      objective: text(input.objective, 1600),
      target_audience: text(input.targetAudience, 1200),
      key_message: text(input.keyMessage, 1200),
      call_to_action: text(input.callToAction, 300),
      content_pillars: list(input.contentPillars, 20, 120),
      channels: list(input.channels, 8, 24),
      start_date: startDate || null,
      end_date: endDate || null,
      status,
      success_metrics: metrics,
    },
  });
  if (error) {
    const forbidden = error.code === "42501";
    return NextResponse.json(
      {
        error: forbidden
          ? "You do not have permission to edit this campaign."
          : "Campaign could not be updated.",
      },
      { status: forbidden ? 403 : 400 },
    );
  }
  return NextResponse.json({ updated: Boolean(data) });
}
