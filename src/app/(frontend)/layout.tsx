import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import {
  Fraunces,
  Inter_Tight,
  JetBrains_Mono,
  Plus_Jakarta_Sans,
  Space_Grotesk,
} from "next/font/google";
import NextTopLoader from "nextjs-toploader";

import { isTheme, type Theme } from "@/lib/theme";

import "./globals.css";

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  preload: true,
  axes: ["SOFT", "WONK", "opsz"],
});

/** Design A (Acid Climate) marketing — geometric sans, scoped via [data-design="acid"] */
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://clearesg.com"),
  title: {
    default: "ClearESG",
    template: "%s · ClearESG",
  },
  description:
    "Enterprise ESG software costs six figures and takes six months. ClearESG gets you audit-ready this quarter.",
  icons: {
    icon: [{ url: "/icon", type: "image/png" }],
    apple: [{ url: "/apple-icon", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    siteName: "ClearESG",
    locale: "en_GB",
  },
};

const hasClerk = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

const clerkAppearance = {
  variables: {
    colorPrimary: "#7A2E2E",
    colorBackground: "#FBF9F5",
    colorText: "#1A1714",
    colorInputBackground: "#F5F2EC",
    colorInputText: "#1A1714",
    borderRadius: "0.25rem",
    fontFamily: "var(--font-inter-tight)",
  },
  elements: {
    card: "bg-surface-1 border border-rule shadow-none",
    headerTitle: "font-display text-ink",
    formButtonPrimary: "bg-accent text-canvas hover:bg-accent-hover",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jar = await cookies();
  const raw = jar.get("clearesg-theme")?.value;
  const theme: Theme = isTheme(raw) ? raw : "light";

  const content = hasClerk ? (
    <ClerkProvider appearance={clerkAppearance} afterSignOutUrl="/">
      {children}
    </ClerkProvider>
  ) : (
    children
  );

  return (
    <html
      lang="en"
      data-theme={theme}
      style={{ colorScheme: theme === "dark" ? "dark" : "light" }}
      className={`${interTight.variable} ${plusJakarta.variable} ${jetbrainsMono.variable} ${fraunces.variable} ${spaceGrotesk.variable} h-full`}
      suppressHydrationWarning
    >
      <body
        className="flex min-h-full flex-col overflow-x-hidden"
        suppressHydrationWarning
      >
        <NextTopLoader
          color="var(--accent)"
          height={2}
          showSpinner={false}
          shadow={false}
        />
        <div className="noise-overlay" aria-hidden />
        {content}
      </body>
    </html>
  );
}
