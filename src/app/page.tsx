import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarRange,
  Layers,
  Lock,
  PenLine,
  Repeat2,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ProductPreview } from "@/components/marketing/product-preview";
import { SiteHeader } from "@/components/marketing/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

const CHANNELS = ["Instagram", "Facebook", "LinkedIn", "YouTube"];

const WORKFLOW: { step: string; title: string; body: string; icon: LucideIcon }[] = [
  {
    step: "01",
    title: "Plan",
    body: "Campaigns, pillars and a shared calendar keep every brand and channel on one rhythm.",
    icon: CalendarRange,
  },
  {
    step: "02",
    title: "Create",
    body: "Write once, then tailor copy and media for each account — in your brand's own voice.",
    icon: PenLine,
  },
  {
    step: "03",
    title: "Publish",
    body: "A durable queue publishes through official APIs and never posts the same thing twice.",
    icon: Send,
  },
  {
    step: "04",
    title: "Measure",
    body: "Reach and engagement flow back into reports your team and clients actually read.",
    icon: BarChart3,
  },
];

const FEATURES: { title: string; body: string; icon: LucideIcon; wide?: boolean }[] = [
  {
    title: "One post, every channel — each one native",
    body: "Separate copy, media and settings for every destination account, checked against each platform's rules before anything is scheduled.",
    icon: Layers,
    wide: true,
  },
  {
    title: "Publishing you can trust",
    body: "Retries are automatic when safe and blocked when an outcome is uncertain, so a network blip never becomes a duplicate post.",
    icon: Repeat2,
  },
  {
    title: "AI that sounds like you",
    body: "Drafts start from your brand identity and stay drafts until a person approves them.",
    icon: Sparkles,
  },
  {
    title: "Built for teams and agencies",
    body: "Workspaces, brands and roles keep clients separate and approvals clear.",
    icon: Users,
  },
  {
    title: "Reports worth sending",
    body: "Period comparisons, executive briefs and print-ready PDFs from the same data your team works in.",
    icon: BarChart3,
  },
];

const TRUST: { title: string; body: string; icon: LucideIcon }[] = [
  {
    title: "Isolation in the database",
    body: "Every workspace is separated by row-level security and tested on every change — not just hidden in the interface.",
    icon: ShieldCheck,
  },
  {
    title: "Credentials stay server-side",
    body: "Account tokens are encrypted at rest and never reach the browser.",
    icon: Lock,
  },
  {
    title: "Official APIs only",
    body: "No scraping and no shared passwords — every connection uses the platform's own sign-in.",
    icon: Send,
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <Container className="pt-16 pb-20 sm:pt-24 lg:pt-28">
            <div className="mx-auto max-w-4xl text-center">
              <Badge tone="outline" className="bg-surface">
                <span className="size-1.5 rounded-full bg-accent-ink" aria-hidden />
                For brands, creators and agencies
              </Badge>
              <h1 className="mt-7 font-display text-[clamp(2.75rem,8vw,6.25rem)] leading-[0.95] font-bold tracking-[-0.045em] text-balance">
                Every channel.{" "}
                <span className="relative inline-block whitespace-nowrap">
                  <span
                    aria-hidden
                    className="absolute inset-x-[-0.04em] -bottom-[0.1em] -z-10 h-[0.13em] -rotate-1 rounded-full bg-accent"
                  />
                  One command.
                </span>
              </h1>
              <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-pretty text-fg-muted sm:text-xl">
                SocialOS is the operating system for social media. Plan, create, publish and measure
                across every account from one calm, reliable workspace.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" className="w-full sm:w-auto">
                  <Link href="/signup">
                    Create your workspace <ArrowRight aria-hidden />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary" className="w-full sm:w-auto">
                  <Link href="/login">Sign in</Link>
                </Button>
              </div>
              <p className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-fg-subtle">
                <span>Publishes to</span>
                {CHANNELS.map((channel) => (
                  <span
                    key={channel}
                    className="rounded-full border border-border bg-surface px-3 py-1 font-medium text-fg-muted"
                  >
                    {channel}
                  </span>
                ))}
              </p>
            </div>

            <div id="product" className="mx-auto mt-16 max-w-5xl scroll-mt-24 sm:mt-20">
              <ProductPreview />
            </div>
          </Container>
        </section>

        {/* Workflow */}
        <section id="workflow" className="scroll-mt-16 border-t border-border bg-surface">
          <Container className="py-20 sm:py-28">
            <div className="max-w-2xl">
              <p className="font-mono text-xs font-medium tracking-[0.18em] text-accent-ink uppercase">
                How it works
              </p>
              <h2 className="mt-4 font-display text-4xl leading-[1.05] font-bold tracking-[-0.035em] text-balance sm:text-5xl">
                Four moves. Every channel.
              </h2>
              <p className="mt-5 text-lg leading-8 text-fg-muted">
                The whole social workflow in one place, so nothing gets lost between the plan and
                the post.
              </p>
            </div>

            <ol className="mt-14 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
              {WORKFLOW.map(({ step, title, body, icon: Icon }) => (
                <li key={step} className="flex flex-col bg-surface p-7">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-fg-subtle">{step}</span>
                    <Icon className="size-5 text-accent-ink" aria-hidden />
                  </div>
                  <h3 className="mt-10 font-display text-2xl font-semibold tracking-tight">
                    {title}
                  </h3>
                  <p className="mt-3 text-[0.9375rem] leading-7 text-fg-muted">{body}</p>
                </li>
              ))}
            </ol>
          </Container>
        </section>

        {/* Features */}
        <section className="border-t border-border">
          <Container className="py-20 sm:py-28">
            <div className="max-w-2xl">
              <p className="font-mono text-xs font-medium tracking-[0.18em] text-accent-ink uppercase">
                The platform
              </p>
              <h2 className="mt-4 font-display text-4xl leading-[1.05] font-bold tracking-[-0.035em] text-balance sm:text-5xl">
                Serious about social. Simple to run.
              </h2>
            </div>

            <div className="mt-14 grid gap-4 md:grid-cols-3">
              {FEATURES.map(({ title, body, icon: Icon, wide }) => (
                <article
                  key={title}
                  className={`group flex flex-col rounded-xl border border-border bg-surface p-7 transition-shadow duration-300 hover:shadow-soft ${wide ? "md:col-span-2" : ""}`}
                >
                  <span className="grid size-11 place-items-center rounded-lg bg-surface-2 transition-colors group-hover:bg-accent">
                    <Icon className="size-5 text-fg" aria-hidden />
                  </span>
                  <h3 className="mt-8 text-xl font-semibold tracking-tight">{title}</h3>
                  <p className="mt-3 max-w-xl text-[0.9375rem] leading-7 text-fg-muted">{body}</p>
                </article>
              ))}
            </div>
          </Container>
        </section>

        {/* Trust */}
        <section id="trust" data-theme="dark" className="scroll-mt-16 bg-bg text-fg">
          <Container className="py-20 sm:py-28">
            <div className="grid gap-14 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
              <div>
                <p className="font-mono text-xs font-medium tracking-[0.18em] text-accent-ink uppercase">
                  Security and reliability
                </p>
                <h2 className="mt-4 font-display text-4xl leading-[1.05] font-bold tracking-[-0.035em] text-balance sm:text-5xl">
                  Built like infrastructure.
                </h2>
                <p className="mt-5 text-lg leading-8 text-fg-muted">
                  Your brand&apos;s voice is on the line every time you publish. SocialOS treats
                  every post, credential and workspace accordingly.
                </p>
              </div>
              <ul className="grid gap-px overflow-hidden rounded-xl border border-border bg-border">
                {TRUST.map(({ title, body, icon: Icon }) => (
                  <li key={title} className="flex gap-5 bg-surface p-7">
                    <Icon className="mt-0.5 size-5 shrink-0 text-accent-ink" aria-hidden />
                    <div>
                      <h3 className="font-semibold tracking-tight">{title}</h3>
                      <p className="mt-2 text-[0.9375rem] leading-7 text-fg-muted">{body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Container>
        </section>

        {/* Closing call to action */}
        <section className="border-t border-border">
          <Container className="py-20 sm:py-24">
            <div className="relative overflow-hidden rounded-2xl bg-accent px-6 py-14 text-center text-accent-fg sm:px-12 sm:py-20">
              <h2 className="mx-auto max-w-3xl font-display text-4xl leading-[1.02] font-bold tracking-[-0.04em] text-balance sm:text-6xl">
                Take command of your social presence.
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-accent-fg/75">
                Set up your workspace in minutes and connect your first channels today.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" variant="solid" className="w-full sm:w-auto">
                  <Link href="/signup">
                    Create your workspace <ArrowRight aria-hidden />
                  </Link>
                </Button>
              </div>
            </div>
          </Container>
        </section>
      </main>

      <footer className="border-t border-border">
        <Container className="flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between">
          <Logo />
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-fg-muted">
            <a href="#product" className="hover:text-fg">
              Product
            </a>
            <a href="#workflow" className="hover:text-fg">
              How it works
            </a>
            <a href="#trust" className="hover:text-fg">
              Security
            </a>
            <Link href="/login" className="hover:text-fg">
              Sign in
            </Link>
          </nav>
          <p className="text-sm text-fg-subtle">© {new Date().getFullYear()} SocialOS</p>
        </Container>
      </footer>
    </div>
  );
}
