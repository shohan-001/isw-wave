// Animated "playing" equalizer bars — pure CSS animation, used on the display
// hero and now-playing indicators.
export function EqualizerBars({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-end gap-[3px] ${className}`}
      aria-hidden
    >
      <span className="w-[3px] h-full origin-bottom rounded-full bg-current animate-eq-1" />
      <span className="w-[3px] h-full origin-bottom rounded-full bg-current animate-eq-2" />
      <span className="w-[3px] h-full origin-bottom rounded-full bg-current animate-eq-3" />
      <span className="w-[3px] h-full origin-bottom rounded-full bg-current animate-eq-2" />
    </span>
  );
}
