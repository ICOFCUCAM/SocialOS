import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://socialos.app"),
  title: {
    default: "SocialOS — Every channel. One command.",
    template: "%s · SocialOS",
  },
  description:
    "SocialOS is the operating system for social media: plan, create, publish and measure across every channel from one workspace.",
  applicationName: "SocialOS",
  openGraph: {
    type: "website",
    siteName: "SocialOS",
    title: "SocialOS — Every channel. One command.",
    description:
      "Plan, create, publish and measure across every channel from one workspace built for teams that take social seriously.",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0c0e" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
