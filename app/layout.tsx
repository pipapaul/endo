import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cycle.",
  description: "Dein Zyklus- und Symptomtracker",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Cycle.",
  },
};

export const viewport: Viewport = {
  themeColor: "#f43f5e",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        {/* Theme hydration script - prevents flash of wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              try {
                var stored = localStorage.getItem('endo-color-scheme');
                if (stored === '"neutral"' || !stored) {
                  document.documentElement.setAttribute('data-theme', 'neutral');
                }
              } catch(e){}
            })();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-rose-50">{children}</body>
    </html>
  );
}
