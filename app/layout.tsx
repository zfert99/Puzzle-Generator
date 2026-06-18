import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

/**
 * Root Layout Component
 * 
 * This file wraps every single page in the application. It is responsible for:
 * 1. Injecting global fonts (Geist and Geist Mono)
 * 2. Setting up the base HTML document structure (<html> and <body> tags)
 * 3. Defining global metadata (like the site title for SEO/browser tabs)
 * 4. Applying global CSS styles that affect the entire app.
 */

// Configure the Geist Sans font
// We use CSS variables to inject the font so it can be easily referenced in Tailwind (via font-sans)
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Configure the Geist Mono font for any code blocks or monospaced numbers
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Global SEO Metadata
// This defines what shows up in the browser tab and search engine results
export const metadata: Metadata = {
  title: "Premium PDF Puzzle Generator",
  description: "Generate customized, print-ready Sudoku puzzle books instantly.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The antialiased class makes the text rendering slightly smoother and thinner, enhancing the premium feel
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* 
        min-h-full and flex flex-col ensures that the body always spans the full height of the viewport.
        This prevents awkward layout breaks on very short pages.
      */}
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
