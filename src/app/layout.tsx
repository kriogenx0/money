import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Money",
  description: "Personal expense categorization",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Nav signOutUrl={process.env.AUTH_MODE === "proxy" ? process.env.SIGN_OUT_URL || null : null} />
        <main>{children}</main>
      </body>
    </html>
  );
}
