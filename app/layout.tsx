import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Verity — AI-assisted media verification",
  description: "Upload suspicious images or videos for a fast, explainable visual manipulation review.",
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
