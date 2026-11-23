import type { Metadata, Viewport } from "next";
import { Inter, Lato } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { getConfig } from "@/lib/config";
import "./globals.css";

// Texto em Inter; nome e títulos em Lato Black itálico maiúsculo, igual ao site principal do Barr4k
const font = Inter({ variable: "--font-main", subsets: ["latin"] });
const lato = Lato({ variable: "--font-title", weight: ["900"], style: ["italic"], subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const { profile } = await getConfig();
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return {
    metadataBase: host ? new URL(`https://${host}`) : undefined,
    title: `${profile.name} — Links`,
    description: profile.bio || `Links do ${profile.name}`,
    openGraph: { title: `${profile.name} — Links`, description: profile.bio, images: profile.heroPoster ? [profile.heroPoster] : undefined },
  };
}

export const viewport: Viewport = { themeColor: "#07060d" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${font.variable} ${lato.variable} antialiased min-h-screen font-sans`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
