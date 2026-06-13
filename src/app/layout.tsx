import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MyLocalHealth",
  description:
    "A local public-health dashboard for respiratory and environmental risk signals.",
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
