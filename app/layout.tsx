import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { TopNav } from "@/components/TopNav";
import { getLocale } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Bolao",
  description: "World Cup sweepstakes app for private football pools.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#126b52",
  width: "device-width",
  initialScale: 1,
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();

  return (
    <html lang={locale}>
      <body>
        <ServiceWorkerRegistration />
        <div className="app-shell">
          <TopNav />
          {children}
        </div>
      </body>
    </html>
  );
}
