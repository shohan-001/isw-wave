"use client";

import type { ReactNode } from "react";
import { themeStyleVars, DEFAULT_ACCENT } from "@/lib/theme";

 /** Applies event accent as CSS variables for Tailwind `wave` / glow utilities. */
export function EventTheme({
  accentColor,
  children,
  className,
}: {
  accentColor?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={themeStyleVars(accentColor || DEFAULT_ACCENT)}
    >
      {children}
    </div>
  );
}
