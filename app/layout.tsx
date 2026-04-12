import type React from "react"
import "./globals.css"
import type { Metadata } from "next"
import Script from "next/script"

import { AppProviders } from "@/components/app-providers"
import { SkipLink } from "@/components/skip-link"

export const metadata: Metadata = {
  title: "OpenMic - Share Your Voice",
  description: "A social video-sharing platform for creative expression",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <Script
          id="openmic-preload-sw-recovery"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  if (${process.env.NEXT_PUBLIC_ENABLE_PWA === "true" ? "true" : "false"}) return;
                  var key = "openmic:preload-sw-recovery-v1";
                  if (sessionStorage.getItem(key) === "1") return;
                  if (!("serviceWorker" in navigator)) return;

                  navigator.serviceWorker.getRegistrations().then(function (registrations) {
                    if (!registrations || registrations.length === 0) return;
                    sessionStorage.setItem(key, "1");
                    Promise.all(registrations.map(function (registration) { return registration.unregister(); }))
                      .then(function () {
                        if (!("caches" in window)) return;
                        return caches.keys().then(function (names) {
                          return Promise.all(names.map(function (name) { return caches.delete(name); }));
                        });
                      })
                      .finally(function () {
                        window.location.reload();
                      });
                  });
                } catch (error) {
                  console.warn("Preload SW recovery failed", error);
                }
              })();
            `,
          }}
        />
      </head>
      {/* Using local/system font styling avoids build-time network dependency on Google Fonts. */}
      <body className="antialiased">
        <SkipLink />
        <div className="min-h-screen bg-black text-white">
          <main id="main-content" tabIndex={-1}>
            <AppProviders>{children}</AppProviders>
          </main>
        </div>
      </body>
    </html>
  )
}
