import { updateBrandIdentity } from "@/lib/actions/brand-identity";

type Identity = {
  logo_url?: string | null;
  colors?: { primary?: string; secondary?: string; accent?: string };
  typography?: { heading?: string; body?: string };
  voice?: { tone?: string; description?: string };
  audience?: string;
  positioning?: string;
  content_pillars?: string[];
  key_messages?: string[];
};

const input =
  "w-full rounded-xl border border-[#dfe7e0] bg-white px-4 py-3 text-sm outline-none focus:border-[#176b4b]";
const area = input + " min-h-24 resize-y";

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold">{label}</label>
      {children}
      {help && <p className="mt-1.5 text-xs text-[#89958d]">{help}</p>}
    </div>
  );
}

export function BrandIdentityForm({ brandId, identity }: { brandId: string; identity: Identity }) {
  const action = updateBrandIdentity.bind(null, brandId);
  const colors = [
    { name: "primary_color", label: "Primary", value: identity.colors?.primary ?? "#176B4B" },
    { name: "secondary_color", label: "Secondary", value: identity.colors?.secondary ?? "#EAF2EC" },
    { name: "accent_color", label: "Accent", value: identity.colors?.accent ?? "#D6A84B" },
  ];
  return (
    <form action={action} className="space-y-8">
      <section>
        <div className="mb-5">
          <h2 className="text-sm font-semibold">Visual identity</h2>
          <p className="mt-1 text-xs text-[#89958d]">
            Define the visual signals used across brand content.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Logo URL"
            help="Use a public image URL for now. Direct uploads will be added with brand asset storage."
          >
            <input
              name="logo_url"
              type="url"
              defaultValue={identity.logo_url ?? ""}
              placeholder="https://example.com/logo.png"
              className={input}
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            {colors.map((c) => (
              <Field key={c.name} label={c.label}>
                <div className="flex h-[46px] items-center gap-2 rounded-xl border border-[#dfe7e0] bg-white px-2">
                  <input
                    aria-label={c.label + " brand colour"}
                    type="color"
                    name={c.name}
                    defaultValue={c.value}
                    className="h-8 w-8 cursor-pointer border-0 bg-transparent p-0"
                  />
                  <span className="text-[10px] text-[#77847b]">{c.value}</span>
                </div>
              </Field>
            ))}
          </div>
        </div>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="Heading typeface">
            <input
              name="heading_font"
              defaultValue={identity.typography?.heading ?? ""}
              placeholder="e.g. Manrope"
              className={input}
            />
          </Field>
          <Field label="Body typeface">
            <input
              name="body_font"
              defaultValue={identity.typography?.body ?? ""}
              placeholder="e.g. Inter"
              className={input}
            />
          </Field>
        </div>
      </section>
      <div className="h-px bg-[#edf1ed]" />
      <section>
        <div className="mb-5">
          <h2 className="text-sm font-semibold">Brand voice</h2>
          <p className="mt-1 text-xs text-[#89958d]">Teach the AI how this brand should sound.</p>
        </div>
        <div className="space-y-5">
          <Field
            label="Voice characteristics"
            help="Examples: confident, warm, authoritative, playful, educational."
          >
            <input
              name="voice_tone"
              defaultValue={identity.voice?.tone ?? ""}
              placeholder="e.g. Clear, confident and approachable"
              className={input}
            />
          </Field>
          <Field label="Voice guidance">
            <textarea
              name="voice_description"
              rows={3}
              defaultValue={identity.voice?.description ?? ""}
              placeholder="Describe how the brand communicates, what to avoid and how it addresses its audience."
              className={area}
            />
          </Field>
        </div>
      </section>
      <div className="h-px bg-[#edf1ed]" />
      <section>
        <div className="mb-5">
          <h2 className="text-sm font-semibold">Audience and positioning</h2>
          <p className="mt-1 text-xs text-[#89958d]">
            Give content generation the context it needs.
          </p>
        </div>
        <div className="space-y-5">
          <Field label="Target audience">
            <textarea
              name="target_audience"
              rows={3}
              defaultValue={identity.audience ?? ""}
              placeholder="Who does this brand serve? Include needs and interests."
              className={area}
            />
          </Field>
          <Field label="Brand positioning">
            <textarea
              name="positioning"
              rows={3}
              defaultValue={identity.positioning ?? ""}
              placeholder="What makes this brand distinct? What promise does it make?"
              className={area}
            />
          </Field>
        </div>
      </section>
      <div className="h-px bg-[#edf1ed]" />
      <section>
        <div className="mb-5">
          <h2 className="text-sm font-semibold">Content strategy</h2>
          <p className="mt-1 text-xs text-[#89958d]">
            One item per line. Up to 20 items in each field.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Content pillars">
            <textarea
              name="content_pillars"
              rows={6}
              defaultValue={(identity.content_pillars ?? []).join("\n")}
              placeholder={"Education\nBehind the scenes\nCustomer stories"}
              className={area}
            />
          </Field>
          <Field label="Key messages">
            <textarea
              name="key_messages"
              rows={6}
              defaultValue={(identity.key_messages ?? []).join("\n")}
              placeholder={"Our core promise\nWhy customers choose us"}
              className={area}
            />
          </Field>
        </div>
      </section>
      <div className="flex justify-end border-t border-[#edf1ed] pt-5">
        <button className="rounded-xl bg-[#176b4b] px-6 py-3 text-sm font-semibold text-white">
          Save brand identity
        </button>
      </div>
    </form>
  );
}
