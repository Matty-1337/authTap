import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "800"],
});

export const metadata: Metadata = {
  title: "AuthTAP",
  description: "One account. Every TAP.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${outfit.variable} h-full antialiased`} suppressHydrationWarning>
      <body
        className={`${outfit.className} flex min-h-full flex-col bg-[#161826] text-[#F2F2F5]`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
