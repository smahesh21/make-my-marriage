import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Make My Marriage",
  description: "Wedding planning and management for Indian weddings.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
