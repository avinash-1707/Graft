import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ThemeProvider } from "@/components/site/ThemeProvider";
import { SmoothScroll } from "@/components/site/SmoothScroll";

export const metadata: Metadata = {
  title: "Graft, support that feels like one warm conversation",
  description:
    "Graft greets every customer with clear, grounded help and passes them softly to your team the moment a person is needed.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>
          <SmoothScroll>
            {/* Grain sits above the per-section backdrop (-z-10) and below content
                (z-10). Each route group supplies its own backdrop. */}
            <div className="grain" aria-hidden="true" />
            {children}
          </SmoothScroll>
        </ThemeProvider>
      </body>
    </html>
  );
}
