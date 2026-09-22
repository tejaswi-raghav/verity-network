import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Verity Network — Explainable media verification",
  description: "Run privacy-conscious edge checks and an explainable multi-layer review of suspicious images or videos.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
