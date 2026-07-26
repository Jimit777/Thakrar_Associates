import type { Metadata } from "next";
import { Josefin_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Brand, headings and interface text: geometric sans with a distinctive look.
const josefinSans = Josefin_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

// Numbers: fixed-width digits so figures line up in columns.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
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
      className={`${josefinSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
