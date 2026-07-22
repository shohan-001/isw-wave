import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

const siteUrl =
  process.env.NEXT_PUBLIC_BASE_URL || "https://isw-wave.isharaka.dev";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "ISW Wave — Live Song Requests",
    template: "%s · ISW Wave",
  },
  description:
    "Scan, search, request. A live song-request wave for events — QR join, YouTube search, moderation, and venue playback.",
  applicationName: "ISW Wave",
  icons: {
    icon: [
      { url: "/brand/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/brand/favicon.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/brand/logo-512.png", sizes: "512x512", type: "image/png" }],
  },
  openGraph: {
    title: "ISW Wave — Live Song Requests",
    description:
      "Live song requests for events. Attendees scan a QR, search YouTube, and the tech lead runs the queue.",
    url: siteUrl,
    siteName: "ISW Wave",
    images: [{ url: "/brand/logo-512.png", width: 512, height: 512, alt: "ISW Wave" }],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "ISW Wave — Live Song Requests",
    description:
      "Live song requests for events. Scan, search, approve, play.",
    images: ["/brand/logo-512.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0a12",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className={`${display.variable} ${body.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
