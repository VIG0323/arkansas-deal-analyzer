import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arkansas Deal Analyzer",
  description: "AI-powered real estate investment analysis for Central Arkansas",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: "#060e1a" }}>
        {children}
      </body>
    </html>
  );
}
