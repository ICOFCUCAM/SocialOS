import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "SocialOS — Your social presence, in command",
  description: "The global operating system for social media management.",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
