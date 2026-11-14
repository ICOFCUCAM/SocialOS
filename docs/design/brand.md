# SocialOS brand and design system

**Owner:** Chief designer
**Status:** v1 — foundation shipped with the new homepage. Every new screen must use this system.

## 1. Positioning

SocialOS is the operating system for social media: one calm, reliable workspace to plan, create, publish and measure across every channel.

- **Promise:** *Every channel. One command.*
- **Personality:** confident, precise, calm, quietly bold. We sound like a trusted operator, not a hype machine.
- **We never:** use invented metrics, fake customer logos or testimonials, stock "social" clichés (hearts, rockets, emoji confetti), or platform logos without permission. Platform names appear as plain text.

## 2. Identity — "Signal"

| Element | Decision |
|---|---|
| Mark | Four-blade pinwheel: each blade is a semicircle (diameter 12 on a 32 grid) rotated in 90° steps around the centre. Every channel, one core. |
| Mark colours | Always Signal lime blades on brand ink. These two colours never change with the theme (`--color-brand-ink`, `--color-brand-signal`). |
| Wordmark | "SocialOS" in Bricolage Grotesque Bold, tracking −3%. |
| Signature colour | Signal lime `#C8F03C`. It is a surface colour; text on lime is always ink. |
| Neutrals | Ink `#0B0C0E` and warm paper `#F5F4EF`. No pure white backgrounds except cards. |

## 3. Typography

| Role | Typeface | Use |
|---|---|---|
| Display | Bricolage Grotesque (variable) | Headlines, big numbers. Bold, tracking −3.5% to −4.5%, tight leading (0.95–1.05). |
| Interface | Geist Sans | All body copy, labels, buttons. |
| Data | Geist Mono | Timestamps, IDs, eyebrows (uppercase, +18% tracking). |

Fonts are bundled from npm (`geist`, `@fontsource-variable/bricolage-grotesque`), so builds never download fonts.

## 4. Tokens

All colours, radii, shadows and motion live in `src/app/globals.css`. Components use **semantic tokens only** — never raw hex values.

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#F5F4EF` | `#0B0C0E` | Page background |
| `surface` / `surface-2` | `#FFFFFF` / `#EDECE6` | `#141518` / `#1C1E22` | Cards; wells and hovers |
| `fg` / `fg-muted` / `fg-subtle` | ink / `#55585F` / `#85888F` | paper / `#A6A9B0` / `#74777E` | Text hierarchy. `fg-subtle` only for large or non-essential text. |
| `border` / `border-strong` | `#E2E0D8` / `#C9C6BB` | `#25272C` / `#383B42` | Dividers; inputs |
| `accent` / `accent-fg` | lime / ink | lime / ink | Primary actions, highlights |
| `accent-ink` | `#4A6B00` | lime | Lime-family text and icons on surfaces |
| `success` `warning` `danger` `info` | AA on paper | AA on ink | Status only, never decoration |

Contrast: every text pairing above meets WCAG AA (4.5:1) in both themes, verified when the tokens were set. `fg-subtle` meets 3:1 and is restricted to large text.

Radii: `sm 6`, `md 10`, `lg 16`, `xl 24`, `2xl 32`. Buttons and badges are fully rounded. Shadows: `shadow-soft` for resting cards, `shadow-lift` for hero objects only. Motion: 200 ms with `ease-out-expo`; everything respects `prefers-reduced-motion`.

Theming: light by default, dark via `prefers-color-scheme`, `<html data-theme>`, or any section with `data-theme="dark"`.

## 5. Components

Built in `src/components/ui` with `cva` variants and the `cn()` helper:

- **Button:** `primary` (lime), `solid` (ink/paper), `secondary`, `ghost`, `link`; sizes `sm`, `md`, `lg`; `asChild` for links.
- **Badge:** `neutral`, `accent`, `outline`, plus status tones.
- **Card, Input, Label, Container.**

Rules: one primary (lime) action per view; icons from Lucide at 16–20px; 16px minimum page gutter on phones; no horizontal scroll at any width.

## 6. Writing

Short sentences. Verbs first on buttons ("Create your workspace", "Schedule 3 posts"). Name things the way customers do: *post*, *channel*, *account*, *campaign*. Never blame the user in errors; say what happened and what to do next.
