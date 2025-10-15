import type { Metadata } from "next";
import "./globals.css";

import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "EndoTrack",
  description: "Mobil-first Endometriose-Tagebuch",
  manifest: "/manifest.json",
  themeColor: "#e11d48",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-screen bg-rose-50 text-slate-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
