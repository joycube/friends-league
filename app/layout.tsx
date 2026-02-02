import React from "react";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "eFootball™ Live evolution™",
  description: "Join the League! eFootball Super League Management System.",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  themeColor: "#020617",
  openGraph: {
    title: "eFootball™ Live evolution™",
    description: "eFootball 2025 기반 리그 매니지먼트 시스템",
    url: "https://friends-league-iota.vercel.app/",
    siteName: "eFootball Live Evolution",
    images: [
      {
        url: "https://www.konami.com/efootball/s/img/main_page_1.png",
        width: 1200,
        height: 630,
        alt: "eFootball Main",
      },
    ],
    locale: "ko_KR",
    type: "website",
  },
  icons: {
    icon: "/icon.webp",
    shortcut: "/icon.webp",
    apple: "/icon.webp",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="antialiased bg-[#020617] text-white">
        {children}
      </body>
    </html>
  );
}