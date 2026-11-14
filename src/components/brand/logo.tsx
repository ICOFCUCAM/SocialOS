import { cn } from "@/lib/cn";

/**
 * The SocialOS mark: four blades turning around one core —
 * every channel, one command. Drawn on a 32-unit grid; each blade is a
 * semicircle of diameter 12 rotated in 90° steps around the centre.
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  const blade = "M16 16V4a6 6 0 0 1 0 12Z";
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-8", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <rect width="32" height="32" rx="9" className="fill-brand-ink" />
      <g className="fill-brand-signal">
        {[0, 90, 180, 270].map((angle) => (
          <path key={angle} d={blade} transform={`rotate(${angle} 16 16)`} />
        ))}
      </g>
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="size-8" />
      <span className="font-display text-[1.375rem] leading-none font-bold tracking-[-0.03em] text-fg">
        SocialOS
      </span>
    </span>
  );
}
