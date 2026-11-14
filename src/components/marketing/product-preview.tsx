import {
  CalendarClock,
  Check,
  CircleDot,
  Image as ImageIcon,
  Loader2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Illustrative product view for the marketing site, composed from real UI
 * patterns rather than a static screenshot. All data is sample data and is
 * labelled as such.
 */

const CHANNELS = [
  { name: "Instagram", active: true },
  { name: "LinkedIn", active: false },
  { name: "YouTube", active: false },
];

const QUEUE = [
  { time: "09:30", title: "Autumn menu reveal", channel: "Instagram", state: "published" },
  { time: "12:00", title: "Behind the roastery", channel: "YouTube", state: "processing" },
  { time: "16:15", title: "Hiring: head barista", channel: "LinkedIn", state: "scheduled" },
] as const;

const STATE_STYLE = {
  published: { label: "Published", className: "bg-success/15 text-success", icon: Check },
  processing: { label: "Processing", className: "bg-warning/15 text-warning", icon: Loader2 },
  scheduled: { label: "Scheduled", className: "bg-info/15 text-info", icon: CalendarClock },
} as const;

const VERSIONS = [
  { channel: "Instagram", detail: "Caption + 4:5 image", ready: true },
  { channel: "LinkedIn", detail: "Long-form copy, no hashtags", ready: true },
  { channel: "YouTube", detail: "Community post · needs review", ready: false },
];

const REACH = [34, 48, 41, 60, 55, 86, 72];

export function ProductPreview({ className }: { className?: string }) {
  return (
    <div
      data-theme="dark"
      role="img"
      aria-label="Product preview with sample data: a post composer with separate copy for Instagram, LinkedIn and YouTube, a publishing queue, and weekly reach."
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-bg text-fg shadow-lift",
        className,
      )}
    >
      <div aria-hidden className="pointer-events-none select-none">
        {/* Window chrome */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-border-strong" />
            <span className="size-2.5 rounded-full bg-border-strong" />
            <span className="size-2.5 rounded-full bg-border-strong" />
          </div>
          <span className="font-mono text-[0.6875rem] tracking-wide text-fg-subtle uppercase">
            Aurora Coffee · Workspace
          </span>
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[0.6875rem] text-fg-muted">
            Sample data
          </span>
        </div>

        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1.35fr_1fr]">
          {/* Composer */}
          <section className="flex flex-col rounded-xl border border-border bg-surface p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">New post</p>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[0.6875rem] font-medium text-accent-fg">
                <Sparkles className="size-3" /> Brand voice
              </span>
            </div>

            <div className="mt-4 flex gap-1.5">
              {CHANNELS.map((channel) => (
                <span
                  key={channel.name}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium",
                    channel.active
                      ? "bg-surface-inverse text-fg-inverse"
                      : "border border-border text-fg-muted",
                  )}
                >
                  {channel.name}
                </span>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-[88px_1fr] gap-4 sm:grid-cols-[112px_1fr]">
              <div className="flex aspect-[4/5] items-end rounded-lg bg-[linear-gradient(160deg,#3b2a1e_0%,#8a5a34_55%,#e2b47a_100%)] p-2">
                <ImageIcon className="size-4 text-white/80" />
              </div>
              <div className="space-y-2 text-[0.8125rem] leading-relaxed">
                <p>
                  The autumn menu is here. Maple cortado, smoked chai and a cinnamon bun worth
                  queuing for.
                </p>
                <p className="text-fg-muted">#autumnmenu #specialtycoffee</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="rounded-md bg-surface-2 px-2 py-1 text-[0.6875rem] text-fg-muted">
                    Caption 142 / 2,200
                  </span>
                  <span className="rounded-md bg-surface-2 px-2 py-1 text-[0.6875rem] text-fg-muted">
                    4:5 · 1080 × 1350
                  </span>
                </div>
              </div>
            </div>

            <ul className="mt-5 mb-5 space-y-2">
              {VERSIONS.map((version) => (
                <li
                  key={version.channel}
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
                >
                  {version.ready ? (
                    <Check className="size-3.5 text-success" />
                  ) : (
                    <CircleDot className="size-3.5 text-warning" />
                  )}
                  <span className="text-[0.8125rem] font-medium">{version.channel}</span>
                  <span className="ml-auto truncate text-[0.6875rem] text-fg-subtle">
                    {version.detail}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
              <span className="inline-flex items-center gap-2 text-xs text-fg-muted">
                <CalendarClock className="size-3.5" /> Thu, 09:30 · Europe/Oslo
              </span>
              <span className="rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-fg">
                Schedule 3 posts
              </span>
            </div>
          </section>

          <div className="grid gap-4">
            {/* Queue */}
            <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
              <p className="text-sm font-semibold">Today</p>
              <ul className="mt-3 divide-y divide-border">
                {QUEUE.map((item) => {
                  const state = STATE_STYLE[item.state];
                  const Icon = state.icon;
                  return (
                    <li key={item.title} className="flex items-center gap-3 py-2.5">
                      <span className="w-10 font-mono text-[0.6875rem] text-fg-subtle">
                        {item.time}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.8125rem]">{item.title}</span>
                        <span className="block text-[0.6875rem] text-fg-subtle">
                          {item.channel}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.6875rem] font-medium",
                          state.className,
                        )}
                      >
                        <Icon className="size-3" /> {state.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Reach */}
            <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-semibold">Reach · 7 days</p>
                <p className="font-mono text-[0.6875rem] text-success">+18.4%</p>
              </div>
              <p className="mt-1 font-display text-3xl font-semibold tracking-tight">128.6K</p>
              <div className="mt-4 flex h-20 items-end gap-1.5">
                {REACH.map((value, index) => (
                  <span
                    key={index}
                    className={cn(
                      "flex-1 rounded-sm",
                      index === REACH.length - 2 ? "bg-accent" : "bg-border-strong",
                    )}
                    style={{ height: `${value}%` }}
                  />
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
