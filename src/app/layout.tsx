import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "میز خدمات ألو شتاب | Alo Shetab Service Desk",
  description:
    "سفارش آنلاین خدمات فنی، خدماتی و تخصصی — از راه دور یا در محل مشتری. قیمت‌گذاری پویا، پرداخت امن شاپرک/شتاب، پیگیری با کد رهگیری و تسویهٔ خودکار.",
  keywords: ["ألو شتاب", "میز خدمات", "سفارش آنلاین خدمات", "تعمیرات", "Alo Shetab"],
  applicationName: "Alo Shetab",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ألو شتاب",
  },
};

export const viewport: Viewport = {
  themeColor: "#177a67",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground min-h-screen flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
