import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { ViewProvider } from "@/lib/view";
import Header from "@/components/Header";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RBConnect",
  description: "Voice of early talent: discussion, events and AI-powered insights.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geist.variable} font-sans antialiased`}>
        <ViewProvider>
          <Header />
          <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        </ViewProvider>
      </body>
    </html>
  );
}
