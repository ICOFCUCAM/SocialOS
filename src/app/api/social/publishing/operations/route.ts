import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user)
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const organizationId = request.nextUrl.searchParams.get("organizationId") || "";
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(organizationId))
    return NextResponse.json({ error: "A valid organizationId is required." }, { status: 400 });

  const [summary, events, jobs] = await Promise.all([
    supabase.rpc("get_publishing_operations_summary", { p_organization_id: organizationId }),
    supabase
      .from("publish_job_events")
      .select(
        "id,job_id,target_id,event_type,attempt_number,error_code,message,metadata,created_at",
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("publish_jobs")
      .select(
        "id,post_id,target_id,status,attempt_count,max_attempts,available_at,last_error_code,last_error_message,created_at,updated_at",
      )
      .eq("organization_id", organizationId)
      .in("status", ["queued", "running", "retry", "dead_letter"])
      .order("updated_at", { ascending: false })
      .limit(100),
  ]);
  if (summary.error || events.error || jobs.error) {
    const forbidden = [summary.error?.code, events.error?.code, jobs.error?.code].includes("42501");
    return NextResponse.json(
      { error: "Publishing operations could not be loaded." },
      { status: forbidden ? 403 : 400 },
    );
  }
  return NextResponse.json({
    summary: summary.data?.[0] ?? null,
    events: events.data ?? [],
    jobs: jobs.data ?? [],
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user)
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return NextResponse.json({ error: "An operations action is required." }, { status: 400 });
  }
  const body = input as Record<string, unknown>;
  const jobId = typeof body.jobId === "string" ? body.jobId : "";
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(jobId))
    return NextResponse.json({ error: "A valid jobId is required." }, { status: 400 });

  let result;
  if (body.action === "retry") {
    result = await supabase.rpc("operator_retry_publish_job", { p_job_id: jobId });
  } else if (body.action === "reconcile_published") {
    const externalPostId =
      typeof body.externalPostId === "string" ? body.externalPostId.trim() : "";
    const permalink = typeof body.permalink === "string" ? body.permalink.trim() : null;
    if (!externalPostId || externalPostId.length > 500 || (permalink && permalink.length > 2000)) {
      return NextResponse.json(
        { error: "A verified externalPostId and valid optional permalink are required." },
        { status: 400 },
      );
    }
    result = await supabase.rpc("operator_reconcile_publish_job", {
      p_job_id: jobId,
      p_external_post_id: externalPostId,
      p_permalink: permalink,
    });
  } else {
    return NextResponse.json(
      { error: "Unsupported publishing operations action." },
      { status: 400 },
    );
  }
  if (result.error) {
    const forbidden = result.error.code === "42501";
    return NextResponse.json(
      {
        error: forbidden
          ? "You do not have permission to perform this action."
          : "The publishing operation could not be completed.",
      },
      { status: forbidden ? 403 : 400 },
    );
  }
  return NextResponse.json({ success: true });
}
