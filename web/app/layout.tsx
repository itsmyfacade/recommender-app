import React from "react";
import "./globals.css";
import type { Metadata } from "next";

/*
  Root layout for the app.
  Loads global styles and wraps all pages.
*/

export const metadata: Metadata = {
  title: "Mini Recommender",
  description: "Find similar products with embeddings",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}