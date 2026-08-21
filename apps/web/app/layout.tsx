import type { Metadata } from "next";
import { SidebarNav } from "../components/sidebar-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Social Growth OS",
  description: "AI-powered autonomous social media growth system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen">
        <SidebarNav />
        <main className="flex-1 p-8">{children}</main>
      </body>
    </html>
  );
}
