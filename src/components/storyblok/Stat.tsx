// src/components/storyblok/Stat.tsx
// One stat with a count-up on scroll. Parses the leading number out of the
// value (e.g. "3.2 GT" -> 3.2 + " GT") and animates it into view. Static final
// value under reduced motion / no JS.
"use client";

import { useEffect, useRef, useState } from "react";

type StatBlok = { _uid: string; component: string; value?: string; label?: string };

function parse(v: string) {
  const m = v.match(/^\s*([\d.,]+)(.*)$/);
  if (!m) return { num: null as number | null, decimals: 0, suffix: v };
  const numStr = m[1].replace(/,/g, "");
  const dot = numStr.indexOf(".");
  return {
    num: parseFloat(numStr),
    decimals: dot === -1 ? 0 : numStr.length - dot - 1,
    suffix: m[2],
  };
}

export default function Stat({ blok }: { blok: StatBlok }) {
  const value = blok.value ?? "";
  const { num, decimals, suffix } = parse(value);
  // SSR / final value renders immediately; animation only refines it in view.
  const [shown, setShown] = useState(num);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (num === null) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = ref.current;
    if (reduce || !el || typeof IntersectionObserver === "undefined") return;

    let raf = 0;
    let started = false;
    const animate = () => {
      const duration = 1200;
      let start = 0;
      const tick = (t: number) => {
        if (!start) start = t;
        const p = Math.min((t - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        setShown(num * eased);
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !started) {
          started = true;
          setShown(0);
          animate();
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [num]);

  const display =
    num === null || shown === null ? value : shown.toFixed(decimals) + suffix;

  return (
    <div className="border-t-2 pt-5" style={{ borderColor: "var(--signal)" }}>
      <p
        ref={ref}
        style={{ fontFamily: "var(--font-heading)", color: "var(--ink)" }}
        className="text-4xl font-extrabold leading-none md:text-5xl"
      >
        {display}
      </p>
      {blok.label && (
        <p style={{ color: "var(--ink-2)" }} className="mt-3 leading-relaxed">
          {blok.label}
        </p>
      )}
    </div>
  );
}
