"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BrandMark } from "@/components/BrandMark";
import { EqualizerBars } from "@/components/EqualizerBars";
import {
  ACTIVE_HEADLINE,
  SITE,
} from "@/lib/site";

const fadeUp = {
  initial: { y: 18 },
  whileInView: { y: 0 },
  viewport: { once: true, margin: "-60px" as const, amount: 0.15 },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
};

const STEPS = [
  {
    n: "01",
    title: "Scan the QR",
    body: "Open the link from the hall screen — name + event code, done.",
    icon: QrIcon,
  },
  {
    n: "02",
    title: "Search & request",
    body: "Find any track on YouTube and send it into the live queue.",
    icon: SearchIcon,
  },
  {
    n: "03",
    title: "Organizer approves",
    body: "The tech lead keeps control — approve, reject, or reorder.",
    icon: CheckIcon,
  },
  {
    n: "04",
    title: "Plays on the big screen",
    body: "Approved songs hit the venue display and the speakers.",
    icon: ScreenIcon,
  },
] as const;

const DIFFERENT = [
  {
    title: "Whole YouTube catalog",
    body: "Not locked to one streaming library — search and request almost anything.",
    icon: CatalogIcon,
  },
  {
    title: "No app download",
    body: "Guests join in the browser. Scan, type a name, start requesting.",
    icon: PhoneIcon,
  },
  {
    title: "Organizer stays in charge",
    body: "Approve, reject, and drive playback from the control room.",
    icon: ShieldIcon,
  },
] as const;

const USE_CASES = [
  {
    title: "University tech events",
    body: "Hackathons, competitions, and campus nights where the crowd is already on their phones.",
  },
  {
    title: "Parties & social nights",
    body: "Let guests pitch songs without handing over the aux — you still run the queue.",
  },
  {
    title: "More coming",
    body: "Built first for campus tech events. Broader venues are on the roadmap — not claiming them yet.",
  },
] as const;

export function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Static hero plane: hairline grid + one soft glow. No looping motion. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[760px]"
        aria-hidden
      >
        <div
          className="absolute inset-0 opacity-[0.55]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.045) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage:
              "radial-gradient(120% 70% at 50% 0%, #000 20%, transparent 78%)",
            WebkitMaskImage:
              "radial-gradient(120% 70% at 50% 0%, #000 20%, transparent 78%)",
          }}
        />
        <div
          className="absolute inset-x-0 top-0 h-[520px]"
          style={{
            background:
              "radial-gradient(60% 100% at 22% 0%, rgba(34,211,238,0.12), transparent 70%)",
          }}
        />
      </div>

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8 sm:py-6">
        <BrandMark size={32} />
        <Link
          href="/login?mode=admin"
          className="text-xs font-medium text-white/40 transition hover:text-wave-400"
        >
          Admin login
        </Link>
      </header>

      {/* 1. Hero — copy left, live product panel right */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-20 pt-8 sm:px-8 sm:pb-28 sm:pt-14 lg:pb-32 lg:pt-20">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <motion.div
            initial={{ y: 10 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-wave-400">
              Live song requests for events
            </p>
            <h1 className="mt-5 font-display text-[2.3rem] font-bold leading-[1.1] tracking-tight text-white text-balance sm:text-5xl sm:leading-[1.06] lg:text-[3.4rem]">
              {ACTIVE_HEADLINE}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/55 sm:text-lg">
              Guests scan a QR, search YouTube, and request tracks. You moderate
              the queue and play them on the big screen — no guest app install.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <motion.div whileTap={{ scale: 0.97 }}>
                <Link
                  href="/login"
                  className="inline-flex w-full items-center justify-center rounded-xl bg-wave px-7 py-3.5 text-base font-bold text-white shadow-glow transition hover:brightness-110 sm:w-auto"
                >
                  I have an event code
                </Link>
              </motion.div>
              <a
                href="#organizers"
                className="inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white/70 transition hover:border-white/25 hover:text-white sm:w-auto"
              >
                For organizers
              </a>
            </div>

            <p className="mt-7 text-xs text-white/30">
              Used at university tech events · no signup for guests
            </p>
          </motion.div>

          <motion.div
            initial={{ y: 16 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <QueuePreview />
          </motion.div>
        </div>
      </section>

      {/* 2. How it works */}
      <motion.section
        {...fadeUp}
        className="relative z-10 mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28"
        aria-labelledby="how-heading"
      >
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-wave-400">
          How it works
        </p>
        <h2
          id="how-heading"
          className="mt-3 font-display text-3xl font-bold text-white sm:text-4xl"
        >
          Four steps from QR to speakers
        </h2>
        <p className="mt-3 max-w-xl text-white/50">
          Built so attendees get it in seconds — and organizers keep the night
          under control.
        </p>

        <ol className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {STEPS.map((step, i) => (
            <motion.li
              key={step.n}
              initial={{ y: 14 }}
              whileInView={{ y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
              className="relative"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-surface/80 text-wave shadow-glow">
                <step.icon />
              </div>
              <p className="font-display text-xs font-semibold tracking-[0.18em] text-white/30">
                {step.n}
              </p>
              <h3 className="mt-1.5 font-display text-lg font-semibold text-white">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/50">
                {step.body}
              </p>
            </motion.li>
          ))}
        </ol>
      </motion.section>

      {/* 3. Why different */}
      <motion.section
        {...fadeUp}
        className="relative z-10 border-y border-white/[0.06] bg-white/[0.02]"
        aria-labelledby="why-heading"
      >
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-wave-400">
            Why it&apos;s different
          </p>
          <h2
            id="why-heading"
            className="mt-3 max-w-xl font-display text-3xl font-bold text-white sm:text-4xl"
          >
            More songs. Less friction. You still run the night.
          </h2>

          <ul className="mt-12 grid gap-12 md:grid-cols-3 md:gap-8">
            {DIFFERENT.map((item, i) => (
              <motion.li
                key={item.title}
                initial={{ y: 12 }}
                whileInView={{ y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07, duration: 0.4 }}
              >
                <div className="mb-4 text-wave">
                  <item.icon />
                </div>
                <h3 className="font-display text-lg font-semibold text-white">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/50">
                  {item.body}
                </p>
              </motion.li>
            ))}
          </ul>
        </div>
      </motion.section>

      {/* 4. Use cases */}
      <motion.section
        {...fadeUp}
        className="relative z-10 mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28"
        aria-labelledby="use-heading"
      >
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-wave-400">
          Where it fits
        </p>
        <h2
          id="use-heading"
          className="mt-3 font-display text-3xl font-bold text-white sm:text-4xl"
        >
          Proven on campus. Honest about the rest.
        </h2>
        <p className="mt-3 max-w-xl text-white/50">
          ISW Wave has been used at university tech events. Parties are a
          natural fit — we&apos;re not pretending it&apos;s everywhere yet.
        </p>

        <ul className="mt-12 space-y-0 divide-y divide-white/[0.07] border-y border-white/[0.07]">
          {USE_CASES.map((item) => (
            <li
              key={item.title}
              className="grid gap-2 py-7 sm:grid-cols-[minmax(0,14rem)_1fr] sm:gap-10"
            >
              <h3 className="font-display text-base font-semibold text-white">
                {item.title}
              </h3>
              <p className="text-sm leading-relaxed text-white/50">{item.body}</p>
            </li>
          ))}
        </ul>
      </motion.section>

      {/* Organizer CTA — coming soon (b) */}
      <motion.section
        id="organizers"
        {...fadeUp}
        className="relative z-10 scroll-mt-8"
        aria-labelledby="org-heading"
      >
        <div className="mx-auto max-w-6xl px-5 pb-20 sm:px-8 sm:pb-28">
          <div className="rounded-3xl border border-white/10 bg-surface/70 px-6 py-10 shadow-glow backdrop-blur sm:px-10 sm:py-12">
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-wave-400">
              For organizers
            </p>
            <h2
              id="org-heading"
              className="mt-3 font-display text-2xl font-bold text-white sm:text-3xl"
            >
              Run your own event — reviewed, then yours
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/50 sm:text-base">
              Tell us about your event and when it starts. Every event shares one
              YouTube search quota, so each one gets a quick manual review —
              approved organizers get their own join code, queue, and control
              room.
            </p>
            <div className="mt-7">
              <motion.div whileTap={{ scale: 0.97 }} className="inline-block">
                <Link
                  href="/host"
                  className="inline-flex w-full items-center justify-center rounded-xl bg-wave px-6 py-3 text-sm font-bold text-white shadow-glow transition hover:brightness-110 sm:w-auto"
                >
                  Request to host an event
                </Link>
              </motion.div>
            </div>

            {/* Invite signup is a shortcut for organizers we contacted directly.
                Framed as a footnote so requesters don't think a code is required. */}
            <p className="mt-5 text-xs leading-relaxed text-white/30">
              Already been sent an invite code by us?{" "}
              <Link
                href="/organizer/signup"
                className="text-white/55 underline decoration-white/20 underline-offset-4 transition hover:text-wave-400"
              >
                Sign up with it instead
              </Link>
              . If that means nothing to you, the request form above is the right
              way in — no code needed.
            </p>
          </div>
        </div>
      </motion.section>

      {/* 5. Footer */}
      <footer className="relative z-10 border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <BrandMark size={28} />
            <p className="mt-3 text-sm text-white/40">
              Built by{" "}
              <a
                href={SITE.portfolioUrl}
                className="text-white/70 underline-offset-2 hover:text-wave-400 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                {SITE.author}
              </a>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/40">
            <a
              href={SITE.githubUrl}
              className="hover:text-wave-400"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            <a
              href={SITE.portfolioUrl}
              className="hover:text-wave-400"
              target="_blank"
              rel="noreferrer"
            >
              Portfolio
            </a>
            <Link href="/login" className="hover:text-wave-400">
              Join event
            </Link>
            <span className="text-white/25">
              © {new Date().getFullYear()} {SITE.author}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Mirrors the real hall display: now playing + vote-ordered queue. Art comes
// straight from i.ytimg.com like the rest of the app (see hiResThumb in
// RequestClient) — no API call, so this costs no YouTube quota.
const NOW_PLAYING = {
  videoId: "TUVcZfQe-Kw",
  title: "Levitating",
  artist: "Dua Lipa",
};

const UP_NEXT = [
  {
    videoId: "ApXoWvfEYVU",
    title: "Sunflower",
    artist: "Post Malone, Swae Lee",
    votes: 12,
  },
  {
    videoId: "H5v3kku4y6Q",
    title: "As It Was",
    artist: "Harry Styles",
    votes: 9,
  },
  {
    videoId: "34Na4j8AVgA",
    title: "Starboy",
    artist: "The Weeknd",
    votes: 7,
  },
] as const;

function QueuePreview() {
  return (
    <div className="glass-edge relative overflow-hidden rounded-2xl p-5 sm:p-6" aria-hidden>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
          Hall display
        </p>
        <span className="rounded-md bg-white/[0.06] px-2 py-1 font-display text-[11px] font-semibold tracking-[0.14em] text-wave-400">
          DEMO01
        </span>
      </div>

      <div className="mt-5 flex items-center gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white/[0.06] shadow-glow">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://i.ytimg.com/vi/${NOW_PLAYING.videoId}/hqdefault.jpg`}
            alt=""
            width={64}
            height={64}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <EqualizerBars className="h-3 text-wave" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-wave-400">
              Now playing
            </span>
          </div>
          <p className="mt-1.5 truncate font-display text-base font-semibold text-white">
            {NOW_PLAYING.title}
          </p>
          <p className="truncate text-sm text-white/40">{NOW_PLAYING.artist}</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.07]">
          <div className="h-full w-[38%] rounded-full bg-wave" />
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-white/30">
          <span>1:24</span>
          <span>3:47</span>
        </div>
      </div>

      <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
        Up next · by votes
      </p>
      <ul className="mt-3 space-y-2.5">
        {UP_NEXT.map((track, i) => (
          <li key={track.videoId} className="flex items-center gap-3">
            <span className="w-4 shrink-0 font-display text-xs text-white/25">
              {i + 1}
            </span>
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-white/[0.06]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://i.ytimg.com/vi/${track.videoId}/mqdefault.jpg`}
                alt=""
                width={36}
                height={36}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white/85">
                {track.title}
              </p>
              <p className="truncate text-xs text-white/35">{track.artist}</p>
            </div>
            <span className="shrink-0 rounded-md bg-white/[0.05] px-2 py-1 text-[11px] font-semibold text-white/50">
              ▲ {track.votes}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function QrIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 3h3v3h-3v-3Zm3-3h3v3h-3v-3Zm-3 0h3v3h-3v-3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M16.5 16.5 20 20"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="m8.5 12.5 2.5 2.5 4.5-5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ScreenIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="4"
        width="18"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M8 20h8M12 16v4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CatalogIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 18V6.5a2.5 2.5 0 0 1 5 0V16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="7" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="14" cy="16" r="2.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="7"
        y="2.5"
        width="10"
        height="19"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M10 18.5h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3 5 6.5v5.2c0 4.2 2.8 7.9 7 9.3 4.2-1.4 7-5.1 7-9.3V6.5L12 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="m9 12 2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
