import Image from "next/image";

export function BrandMark({
  size = 32,
  showWordmark = true,
  className = "",
}: {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Image
        src="/brand/logo-512.png"
        alt="ISW Wave"
        width={size}
        height={size}
        className="rounded-lg"
        priority
      />
      {showWordmark ? (
        <span className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-white">
          ISW Wave
        </span>
      ) : null}
    </span>
  );
}
