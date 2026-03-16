import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { getServerSession } from "next-auth";

import Providers from "@/app/providers";
import { authOptions } from "@/lib/auth";
import SiteNavbar from "@/components/layout/site-navbar";
import SiteFooter from "@/components/layout/site-footer";
import AdBanner from "@/components/ads/ad-banner";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim() ?? "";
const hasAdsense = adsenseClient.startsWith("ca-pub-");

export const metadata: Metadata = {
  metadataBase: new URL("https://arcadiax.de"),
  title: {
    default: "ArcadiaX",
    template: "%s | ArcadiaX",
  },
  description:
    "ArcadiaX is a platform for retro gaming, game releases and community discussions.",
  applicationName: "ArcadiaX",
  keywords: [
    "ArcadiaX",
    "retro gaming",
    "game releases",
    "emulator games",
    "retro platform",
    "gaming community",
  ],
  authors: [{ name: "ArcadiaX" }],
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/icon.png",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "ArcadiaX",
    description:
      "ArcadiaX is a platform for retro gaming, game releases and community discussions.",
    url: "https://arcadiax.de",
    siteName: "ArcadiaX",
    locale: "de_DE",
    type: "website",
    images: [
      {
        url: "/cover.png",
        width: 1200,
        height: 630,
        alt: "ArcadiaX",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ArcadiaX",
    description:
      "ArcadiaX is a platform for retro gaming and game releases.",
    images: ["/cover.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#05070b",
  colorScheme: "dark",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  const user = session?.user
    ? {
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        role: session.user.role ?? null,
      }
    : null;

  return (
    <html lang="de" suppressHydrationWarning>
      <body
        className={`${inter.variable} min-h-screen bg-[#05070b] font-sans text-white antialiased`}
      >
        {hasAdsense && (
          <Script
            id="google-adsense"
            strategy="beforeInteractive"
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`}
            crossOrigin="anonymous"
          />
        )}

        <Providers>
          <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#05070b] text-white">

            <SiteNavbar user={user} />

            {/* GLOBAL AD BANNER */}
            {hasAdsense && (
              <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
                <AdBanner
                  adSlot="1234567890"
                  className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                  adFormat="horizontal"
                  fullWidthResponsive
                />
              </div>
            )}

            <main className="relative z-10 flex-1">
              <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
                {children}
              </div>
            </main>

            <SiteFooter user={user} />

          </div>
        </Providers>
      </body>
    </html>
  );
}