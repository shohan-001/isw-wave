"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

// Renders a QR code (as a PNG data URL) pointing at the given URL. Used on the
// projector/display page so attendees can scan to open the request page.
export function QRCodeBlock({ url }: { url: string }) {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    QRCode.toDataURL(url, {
      margin: 1,
      width: 320,
      color: { dark: "#0b0a12", light: "#ffffff" },
    })
      .then(setDataUrl)
      .catch(() => setDataUrl(""));
  }, [url]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-2xl bg-white p-3 shadow-glow">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dataUrl}
            alt="Scan to request a song"
            className="h-40 w-40 xl:h-48 xl:w-48"
          />
        ) : (
          <div className="h-40 w-40 xl:h-48 xl:w-48" />
        )}
      </div>
      <p className="text-center font-display text-sm font-medium uppercase tracking-[0.2em] text-white/60">
        Scan to request
      </p>
    </div>
  );
}
