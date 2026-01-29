import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

// -----------------------------------------------------------------------------
// 📢 [SNS 공유 설정] 미리보기 이미지 및 텍스트
// -----------------------------------------------------------------------------
export const metadata: Metadata = {
  title: "eFOOTBALL LEAGUE™",
  description: "eFOOTBALL 커뮤니티 리그를 함께 즐겨보자! 가입문의 joycube@gmail.com",
  openGraph: {
    title: "eFOOTBALL LEAGUE™",
    description: "eFOOTBALL 커뮤니티 리그를 함께 즐겨보자! 가입문의 joycube@gmail.com",
    images: [
      {
        url: "https://www.konami.com/efootball/s/img/main_page_1.png?v=903", // 상단 배너 이미지
        width: 1200,
        height: 630,
        alt: "eFOOTBALL LEAGUE Banner",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "eFOOTBALL LEAGUE™",
    description: "eFOOTBALL 커뮤니티 리그를 함께 즐겨보자! 가입문의 joycube@gmail.com",
    images: ["https://www.konami.com/efootball/s/img/main_page_1.png?v=903"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={inter.className}>{children}</body>
    </html>
  );
}