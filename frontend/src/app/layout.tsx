'use client';

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { useEffect } from "react";
import { configureAmplify } from "@/lib/amplify-config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  useEffect(() => {
    // Configure Amplify on client side
    configureAmplify();
  }, []);

  return (
    <html lang="ja">
      <head>
        <title>EleKnowledge-AI</title>
        <meta name="description" content="AI-powered knowledge management system for electrical equipment" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
