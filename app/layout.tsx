import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EndoTrack",
  description: "Minimalistische Endometriose-Tracking App",
  manifest: "/manifest.webmanifest",
  themeColor: "#f43f5e",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body className="min-h-screen bg-rose-50">{children}</body>
    </html>
  );
}
