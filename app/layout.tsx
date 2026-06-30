import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Santa Fe Auction Alerts",
  description: "Monitor Copart and IAAI for Hyundai Santa Fe Calligraphy auctions.",
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
