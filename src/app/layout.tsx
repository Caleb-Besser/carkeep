import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "CarKeep — 2016 Acura ILX",
  description: "A calm, guided routine for weekly and monthly car checks.",
  icons: {
    icon: "/carkeep-icon.png",
    shortcut: "/carkeep-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${manrope.variable} ${ibmPlexMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-[color:var(--background)] text-[color:var(--foreground)]">
        {children}
      </body>
    </html>
  );
}
