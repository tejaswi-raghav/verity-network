import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Verity Network — Synthetic Media Verification",
  description: "Explainable deepfake and synthetic media verification for people and platforms.",
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
