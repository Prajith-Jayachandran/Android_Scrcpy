import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Android Screen Mirror - WebCodecs 60 FPS",
  description: "Ultra-low-latency, pure-web Android screen mirroring and control dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-[#070a12] text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
