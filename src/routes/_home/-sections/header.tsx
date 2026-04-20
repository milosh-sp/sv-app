import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ArrowRightIcon, TranslateIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { motion, useMotionValue, useSpring } from "motion/react";
import { useEffect, useRef } from "react";

import { LocaleCombobox } from "@/components/locale/combobox";
import { ThemeToggleButton } from "@/components/theme/toggle-button";
import { BrandIcon } from "@/components/ui/brand-icon";
import { Button } from "@/components/ui/button";
import { APP_NAME, SKILL_VERDICT_LINKS } from "@/constants/brand";

import { HOME_ACCENT } from "../-styles";

const TICKER_ITEMS = [
  "VERIFIED SKILLS",
  "NOT KEYWORDS",
  "PEER REVIEWED",
  "EARN WHILE YOU VERIFY",
  "CV 2.0",
  "DON'T CHASE — ATTRACT",
];

function Ticker() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS];

  return (
    <div
      aria-hidden="true"
      className="relative overflow-hidden border-b-2 border-foreground bg-foreground text-background"
      style={{ willChange: "transform" }}
    >
      <motion.div
        className="flex w-max items-center gap-8 py-1.5 font-mono text-[0.7rem] tracking-[0.3em] whitespace-nowrap uppercase"
        animate={{ x: ["0%", "-33.333%"] }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
      >
        {items.map((item, i) => (
          <span key={`${item}-${i}`} className="flex items-center gap-8">
            <span>{item}</span>
            <span aria-hidden="true" style={{ color: HOME_ACCENT.lime }}>
              ●
            </span>
          </span>
        ))}
      </motion.div>
    </div>
  );
}

export function Header() {
  const y = useMotionValue(0);
  const lastScroll = useRef(0);
  const ticking = useRef(false);
  const springY = useSpring(y, { stiffness: 300, damping: 40 });

  useEffect(() => {
    if (typeof window === "undefined") return;

    function onScroll() {
      const current = window.scrollY ?? 0;
      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          if (current > 32 && current > lastScroll.current) {
            y.set(-100);
          } else {
            y.set(0);
          }
          lastScroll.current = current;
          ticking.current = false;
        });
        ticking.current = true;
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [y]);

  return (
    <motion.header
      style={{ y: springY }}
      className="fixed inset-x-0 top-0 z-50 bg-background/90 backdrop-blur-xl"
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <Ticker />

      <nav
        aria-label={t`Main navigation`}
        className="flex items-center gap-x-4 border-b-2 border-foreground px-4 py-3 sm:px-6 lg:px-10"
      >
        <Link
          to="/"
          className="group flex items-center gap-2.5 transition-opacity hover:opacity-80"
          aria-label={t`${APP_NAME} - Go to homepage`}
        >
          <span
            className="flex size-10 items-center justify-center border-2 border-foreground"
            style={{ backgroundColor: HOME_ACCENT.lime }}
          >
            <BrandIcon forceTheme="light" className="size-6" />
          </span>
          <span className="hidden font-mono text-[0.72rem] tracking-[0.18em] uppercase sm:inline">
            {APP_NAME}
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-x-1.5">
          <LocaleCombobox
            render={
              <Button size="icon" variant="ghost" aria-label={t`Change language`}>
                <TranslateIcon />
              </Button>
            }
          />

          <ThemeToggleButton />

          <div className="hidden items-center gap-x-2 pl-2 sm:flex">
            <Button
              size="sm"
              variant="ghost"
              className="font-mono text-[0.72rem] tracking-[0.12em] uppercase"
              nativeButton={false}
              render={
                <a href={SKILL_VERDICT_LINKS.candidate} target="_blank" rel="noopener noreferrer">
                  <Trans>Verify my skills</Trans>
                </a>
              }
            />

            <Button
              size="sm"
              variant="ghost"
              className="font-mono text-[0.72rem] tracking-[0.12em] uppercase"
              nativeButton={false}
              render={
                <a href={SKILL_VERDICT_LINKS.verifier} target="_blank" rel="noopener noreferrer">
                  <Trans>Earn by verifying</Trans>
                </a>
              }
            />

            <Button
              size="sm"
              nativeButton={false}
              aria-label={t`Go to dashboard`}
              className="group h-9 gap-1.5 border-2 border-foreground bg-foreground px-3 font-mono text-[0.72rem] tracking-[0.14em] text-background uppercase hover:bg-background hover:text-foreground"
              render={
                <Link to="/dashboard">
                  <Trans>Launch</Trans>
                  <ArrowRightIcon
                    aria-hidden="true"
                    className="size-3.5 transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              }
            />
          </div>
        </div>
      </nav>
    </motion.header>
  );
}
