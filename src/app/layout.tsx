import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorkerRegister } from "@/components/app/sw-register";

const vazir = localFont({
  src: [
    { path: "../../public/fonts/Vazirmatn-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/Vazirmatn-Medium.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/Vazirmatn-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../../public/fonts/Vazirmatn-Bold.woff2", weight: "700", style: "normal" },
    { path: "../../public/fonts/Vazirmatn-ExtraBold.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-vazir",
  display: "swap",
});

export const metadata: Metadata = {
  title: "پژوهش‌یار هوشمند | ResearchMate AI",
  description:
    "سامانه هوشمند ارزیابی، داوری و ارتقای کیفیت پژوهش — داوری پروپوزال و مقاله، ممیزی آماری، بررسی منابع و ارزیابی آمادگی انتشار",
  keywords: [
    "داوری علمی",
    "ارزیابی پروپوزال",
    "داوری مقاله",
    "پژوهش‌یار هوشمند",
    "ResearchMate AI",
    "peer review",
  ],
  authors: [{ name: "سید مجتبی کاظمی" }],
  applicationName: "پژوهش‌یار هوشمند",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "پژوهش‌یار هوشمند",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0e2a47",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className={`${vazir.variable} antialiased bg-background text-foreground min-h-screen`}>
        <ServiceWorkerRegister />
        {children}
        <Toaster position="bottom-left" richColors closeButton />
      </body>
    </html>
  );
}
