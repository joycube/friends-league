import type { Metadata, Viewport } from "next";
import "./globals.css";

// 🔥 [Meta] Social Image & Favicon Setup
export const metadata: Metadata = {
  title: "eFootball™ Live evolution™",
  description: "Join the League! eFootball Super League Management System.",
  openGraph: {
    title: "eFootball™ Live evolution™",
    description: "eFootball 2025 기반 리그 매니지먼트 시스템",
    url: "https://friends-league-iota.vercel.app/",
    siteName: "eFootball Live Evolution",
    images: [
      {
        url: "https://www.konami.com/efootball/s/img/main_page_1.png", // 요청하신 코나미 이미지
        width: 1200,
        height: 630,
        alt: "eFootball Main",
      },
    ],
    locale: "ko_KR",
    type: "website",
  },
  icons: {
    icon: "/icon.webp",       // public/icon.webp
    shortcut: "/icon.webp",
    apple: "/icon.webp",      // 모바일 홈 화면 추가 시 아이콘
  },
};

export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased bg-[#020617] text-white">
        {children}
      </body>
    </html>
  );
}