import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import BrandIntroShell from "./brand-intro-shell";
import CookiePreferences from "./cookie-preferences";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Glanzio Reinigung | Gebäudereinigung am Bodensee",
    template: "%s | Glanzio Reinigung",
  },
  description:
    "Professionelle Gebäudereinigung und Hausmeisterservice in der Region Bodensee – sauber, zuverlässig und professionell.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <BrandIntroShell />
        {children}
        <CookiePreferences />
      </body>
    </html>
  );
}
