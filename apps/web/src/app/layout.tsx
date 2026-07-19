import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "../../components/providers";
import { TooltipProvider } from "@/components/ui/tooltip";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Pagemint — AI Website Builder for Monad",
  description: "Chat your way to a premium, token-gated landing page for any smart contract on Monad. Mint it on-chain in seconds.",
  openGraph: {
    title: "Pagemint — AI Website Builder for Monad",
    description: "Generate and mint token-gated landing pages for Monad protocols.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#090909] text-white`}
        style={{ fontFamily: "var(--font-geist-sans), Arial, sans-serif", letterSpacing: "-0.04em" }}
      >
        <Providers>
          <TooltipProvider>
            {children}
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
