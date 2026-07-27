"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

// Renders a QR code (as a PNG data URL) pointing at the given URL. Used on the
// projector/display page so attendees can scan to open the request page.
export function QRCodeBlock({
  url,
  compact = false,
  cinematic = false,
}: {
  url: string;
  compact?: boolean;
  cinematic?: boolean;
}) {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    QRCode.toDataURL(url, {
      margin: 1,
      width: compact ? 180 : 320,
      color: {
        dark: cinematic ? "#07080c" : "#0b0a12",
        light: "#ffffff",
      },
    })
      .then(setDataUrl)
      .catch(() => setDataUrl(""));
  }, [url, compact, cinematic]);

  // Compact = display sidebar / mobile row — keep small so it never covers art.
  const sizeClass = compact
    ? "h-24 w-24 sm:h-32 sm:w-32 lg:h-40 lg:w-40"
    : "h-40 w-40 xl:h-48 xl:w-48";

  return (
    <div className="flex flex-col items-center">
      <div
        className={
          cinematic
            ? "rounded-2xl bg-white/95 p-3 shadow-[0_0_40px_-8px_rgba(34,211,238,0.35)]"
            : "rounded-xl bg-white p-2.5 shadow-glow sm:rounded-2xl sm:p-3"
        }
      >
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dataUrl}
            alt="Scan to request a song"
            className={sizeClass}
          />
        ) : (
          <div className={sizeClass} />
        )}
      </div>
    </div>
  );
}
