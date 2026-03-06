import type { Metadata, Viewport } from "next";
import { Cinzel, MedievalSharp } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-cinzel",
});
const medievalSharp = MedievalSharp({ 
  subsets: ["latin"], 
  weight: ["400"],
  variable: "--font-medievalsharp",
});

export const metadata: Metadata = {
  title: "Magic Wind - 杖で風を操る魔法アプリ",
  description:
    "カメラの前で魔法の杖のジェスチャーを行うことでスマートプラグに接続されたサーキュレーターを操作するIoTアプリ",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a1a2e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={`font-sans antialiased min-h-screen ${cinzel.variable} ${medievalSharp.variable}`}>
      {children}
    </div>
  );
}
