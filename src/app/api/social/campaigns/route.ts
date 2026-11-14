import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const platforms = new Set(["instagram","facebook","youtube","linkedin","threads","pinterest","tiktok","x"]);
const statuses = new Set(["draft","planned"]);

function boundedText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function stringList(value: unknown, max: number, itemMax: number) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string")
    .map(item => item.trim().slice(0,itemMax)).filter(Boolean))].slice(0,max);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {data:{user}} = await supabase.auth.getUser();
  if (!user) return NextResponse.json({error:"Authentication required."},{status:401});
  let raw: string;
  try { raw = await request.text(); } catch { return NextResponse.json({error:"Invalid request."},{status:400}); }
  if (raw.length > 16_000) return NextResponse.json({error:"Campaign brief is too large."},{status:413});
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({error:"A valid JSON body is required."},{status:400}); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({error:"Campaign details are required."},{status:400});
  const input = body as Record<string,unknown>;
  const organizationId = boundedText(input.organizationId,64);
  const brandId = boundedText(input.brandId,64);
  const name = boundedText(input.name,160);
  const status = boundedText(input.status,16) || "draft";
  const channels = stringList(input.channels,8,24);
  const pillars = stringList(input.contentPillars,20,120);
  const metrics = Array.isArray(input.successMetrics) ? input.successMetrics.slice(0,10).map(item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const metric = item as Record<string,unknown>;
    return {name:boundedText(metric.name,80),target:boundedText(metric.target,80),unit:boundedText(metric.unit,30)};
  }).filter((item): item is {name:string;target:string;unit:string} => Boolean(item?.name)) : [];
  if (!uuid.test(organizationId) || !uuid.test(brandId)) return NextResponse.json({error:"Select a valid workspace and brand."},{status:400});
  if (name.length < 2) return NextResponse.json({error:"Campaign name must contain at least two characters."},{status:400});
  if (!statuses.has(status)) return NextResponse.json({error:"New campaigns can be saved as drafts or planned."},{status:400});
  if (channels.some(channel=>!platforms.has(channel))) return NextResponse.json({error:"One or more channels are unsupported."},{status:400});
  const startDate = boundedText(input.startDate,10);
  const endDate = boundedText(input.endDate,10);
  if ((startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) || (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate))) {
    return NextResponse.json({error:"Campaign dates must use YYYY-MM-DD."},{status:400});
  }
  if (startDate && endDate && endDate < startDate) return NextResponse.json({error:"End date must not precede start date."},{status:400});
  const {data:id,error} = await supabase.rpc("create_social_campaign",{p_payload:{
    organization_id:organizationId,brand_id:brandId,name,status,
    description:boundedText(input.description,3000),
    objective:boundedText(input.objective,1600),
    target_audience:boundedText(input.targetAudience,1200),
    key_message:boundedText(input.keyMessage,1200),
    call_to_action:boundedText(input.callToAction,300),
    content_pillars:pillars,channels,start_date:startDate||null,end_date:endDate||null,
    success_metrics:metrics
  }});
  if (error) {
    const forbidden=error.code==="42501";
    return NextResponse.json({error:forbidden?"You do not have permission to create a campaign for this brand.":"Campaign could not be created."},{status:forbidden?403:400});
  }
  return NextResponse.json({id,status},{status:201});
}
