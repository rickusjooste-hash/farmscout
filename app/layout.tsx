import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SwUpdateListener from "@/app/components/SwUpdateListener";
import ManagerSwRegister from "@/app/components/ManagerSwRegister";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "FarmScout",
  description: "Field Inspection App",
  manifest: "/manifest-manager.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#1c3a2a" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="FarmScout" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="apple-touch-icon" href="/icon-manager-192.png" />
      </head>
      <body
        className={`${inter.variable} antialiased`}
      >
        <SwUpdateListener />
        <ManagerSwRegister />
        {children}
      </body>
    </html>
  );
}