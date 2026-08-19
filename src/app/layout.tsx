import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "sonner";
import { Providers } from "@/components/providers";
import { OfflineBar, PwaRegistration } from "@/components/pwa-registration";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { PerformanceObserver } from "@/components/performance-observer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#09090b',
};

export const metadata: Metadata = {
  title: "OmniVote Monitor — Election Command Center",
  description: "Secure, real-time election monitoring platform with AI-powered threat detection.",
  manifest: "/manifest.json",
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>
          {/* Skip to main content link for keyboard/screen reader users */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-emerald focus:text-emerald-950 focus:rounded-md focus:text-sm focus:font-medium"
          >
            Skip to main content
          </a>
          <OfflineBar />
          <PwaRegistration />
          <PwaInstallPrompt />
          <PerformanceObserver />
          {children}
          <SonnerToaster
            position="top-right"
            richColors
            closeButton
            duration={6000}
            toastOptions={{
              className: 'text-xs',
            }}
          />
        </Providers>
      </body>
    </html>
  );
}