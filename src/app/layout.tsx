import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AURA | Personal AI Workspace",
  description: "A calm, voice-first home for your thoughts, projects and memories.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
