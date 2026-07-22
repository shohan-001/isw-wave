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
      width: compact ? 240 : 320,
      color: {
        dark: cinematic ? "#07080c" : "#0b0a12",
        light: "#ffffff",
      },
    })
      .then(setDataUrl)
      .catch(() => setDataUrl(""));
  }, [url, compact, cinematic]);

  const sizeClass = compact
    ? "h-36 w-36 sm:h-40 sm:w-40 lg:h-44 lg:w-44"
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
