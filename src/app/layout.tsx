import type { Metadata } from "next";
import { Poppins, DM_Mono } from "next/font/google";
import "./globals.css";

// Geometric and open — softer than a neutral UI sans without losing clarity.
const poppins = Poppins({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
});

/*
 * Figures stay monospaced so columns line up: in a proportional font a "1" is
 * narrower than an "8", and a table of periods jitters as values change.
 * DM Mono is rounder than the usual coding monospace and sits well with Poppins.
 */
const dmMono = DM_Mono({
  variable: "--font-mono",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Thakrar Associates",
  description: "Portfolio tracking and stock research",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${dmMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
