"use client";

import type { ReactNode } from "react";

export function GlassPanel({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "aside" | "header";
}) {
  return (
    <Tag className={`glass-edge rounded-3xl ${className}`}>{children}</Tag>
  );
}
