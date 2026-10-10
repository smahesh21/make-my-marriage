import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Make My Marriage — Your wedding. Beautifully organized.",
  description:
    "A shared wedding workspace for couples and families planning an Indian wedding.",
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
