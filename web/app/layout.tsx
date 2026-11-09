import React from "react";
import "./globals.css";
import type { Metadata } from "next";

/*
  Root layout for the app.
  Loads global styles and wraps all pages.
*/

export const metadata: Metadata = {
  title: "Semantic Discovery | Embedding Search",
  description: "Explore semantic product matches with real MiniLM embedding inference.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
