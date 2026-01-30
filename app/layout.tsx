import React from 'react';
import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'eFOOTBALL SUPER LEAGUE - 지금 e풋볼 리그에 도전하세요',
  description: '지금 eFOOTBALL 리그에 참여하세요. 참여문의 joycube@gamil.com',
  icons: {
    icon: '/icon.webp', // public 폴더에 이미지 파일을 icon.webp로 저장하세요
    shortcut: '/icon.webp',
  },
  openGraph: {
    title: 'eFOOTBALL SUPER LEAGUE',
    description: '지금 eFOOTBALL 리그에 참여하세요. 참여문의 joycube@gamil.com',
    siteName: 'eFOOTBALL SUPER LEAGUE',
    locale: 'ko_KR',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className={inter.className}>{children}</body>
    </html>
  )
}