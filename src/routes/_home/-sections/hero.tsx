import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ArrowRightIcon, SealCheckIcon, SparkleIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";

import { CometCard } from "@/components/animation/comet-card";
import { Button } from "@/components/ui/button";
import { APP_NAME, SKILL_VERDICT_LINKS } from "@/constants/brand";

import { HOME_ACCENT, HOME_GRID_BG } from "../-styles";

function HeroBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className={`absolute inset-0 ${HOME_GRID_BG} opacity-60`} />

      <motion.div
        className="absolute -top-24 -left-24 size-128 rounded-full blur-3xl"
        style={{ backgroundColor: HOME_ACCENT.magentaSoft, willChange: "transform" }}
        animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="absolute -right-24 -bottom-16 size-144 rounded-full blur-3xl"
        style={{ backgroundColor: HOME_ACCENT.limeSoft, willChange: "transform" }}
        animate={{ x: [0, -30, 0], y: [0, -20, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />

      <div
        className="absolute inset-x-0 bottom-0 h-48"
        style={{ background: "linear-gradient(to bottom, transparent, var(--color-background))" }}
      />
    </div>
  );
}

function HeroMarquee() {
  const items = ["DON'T CHASE", "ATTRACT", "DON'T CHASE", "ATTRACT", "DON'T CHASE", "ATTRACT"];

  return (
    <div
      aria-hidden="true"
      className="absolute inset-x-0 bottom-0 overflow-hidden border-y-2 border-foreground bg-foreground text-background"
    >
      <motion.div
        className="flex w-max items-center gap-10 py-2 font-mono text-xs tracking-[0.35em] whitespace-nowrap uppercase sm:text-sm"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      >
        {[...items, ...items, ...items, ...items].map((item, i) => (
          <span key={i} className="flex items-center gap-10">
            <span>{item}</span>
            <span aria-hidden="true" style={{ color: HOME_ACCENT.lime }}>
              ✦
            </span>
          </span>
        ))}
      </motion.div>
    </div>
  );
}

export function Hero() {
  return (
    <section
      id="hero"
      className="relative flex min-h-svh w-full flex-col items-center justify-center overflow-hidden pt-32 pb-28 sm:pt-36 md:pt-40"
    >
      <HeroBackdrop />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center px-4 text-center sm:px-6">
        <motion.a
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          target="_blank"
          rel="noopener noreferrer"
          href={SKILL_VERDICT_LINKS.home}
          className="inline-flex items-center gap-2 border-2 border-foreground bg-background px-3 py-1 font-mono text-[0.7rem] tracking-[0.22em] uppercase transition-colors hover:bg-foreground hover:text-background"
          style={{ willChange: "transform, opacity" }}
        >
          <SparkleIcon aria-hidden="true" weight="fill" className="size-3" style={{ color: HOME_ACCENT.magenta }} />
          <Trans>Introducing CV 2.0</Trans>
        </motion.a>

        <motion.h1
          className="mt-8 text-5xl leading-[0.95] font-black tracking-tight sm:text-6xl md:text-7xl lg:text-[7.5rem]"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.2 }}
          style={{ willChange: "transform, opacity" }}
        >
          <Trans>
            <span className="block">Don't chase.</span>
            <span className="relative inline-block">
              <span className="relative z-10 font-serif italic">Attract</span>
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-1 z-0 h-4 sm:h-5 md:h-6 lg:h-10"
                style={{ backgroundColor: HOME_ACCENT.lime }}
              />
            </span>
            <span className="block">opportunities.</span>
          </Trans>
        </motion.h1>

        <motion.p
          className="mt-8 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.45 }}
          style={{ willChange: "transform, opacity" }}
        >
          <Trans>
            Build a dynamic CV 2.0, earn peer-verified skill badges, and share your proof with employers through a
            single link or QR code.
          </Trans>
        </motion.p>

        <motion.div
          className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.6 }}
          style={{ willChange: "transform, opacity" }}
        >
          <Button
            size="lg"
            nativeButton={false}
            className="group h-12 gap-2 border-2 border-foreground px-6 font-mono text-xs tracking-[0.16em] uppercase shadow-[4px_4px_0_0_var(--color-foreground)] transition-[transform,box-shadow] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_var(--color-foreground)]"
            style={{ backgroundColor: HOME_ACCENT.lime, color: HOME_ACCENT.ink }}
            render={
              <Link to="/dashboard">
                <Trans>Build my CV 2.0</Trans>
                <ArrowRightIcon aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            }
          />

          <Button
            size="lg"
            variant="ghost"
            className="h-12 gap-2 border-2 border-foreground bg-background px-6 font-mono text-xs tracking-[0.16em] uppercase hover:bg-foreground hover:text-background"
            nativeButton={false}
            render={
              <a href={SKILL_VERDICT_LINKS.candidate} target="_blank" rel="noopener noreferrer">
                <SealCheckIcon aria-hidden="true" className="size-4" />
                <Trans>Verify my skills</Trans>
                <span className="sr-only">
                  <Trans>(opens in new tab)</Trans>
                </span>
              </a>
            }
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.75, ease: "easeOut" }}
          style={{ willChange: "transform, opacity" }}
          className="relative mt-16 w-full max-w-5xl md:mt-24"
        >
          <div
            aria-hidden="true"
            className="absolute -inset-1 -z-10 translate-x-2 translate-y-2 border-2 border-foreground"
            style={{ backgroundColor: HOME_ACCENT.magenta }}
          />

          <CometCard glareOpacity={0} className="relative">
            <div className="relative overflow-hidden border-2 border-foreground bg-card">
              <div
                className="absolute top-2 left-2 z-10 flex items-center gap-1.5 border-2 border-foreground bg-background px-2 py-0.5 font-mono text-[0.6rem] tracking-[0.2em] uppercase"
                aria-hidden="true"
              >
                <span className="size-1.5 rounded-full" style={{ backgroundColor: HOME_ACCENT.lime }} />
                Live Demo
              </div>

              <video
                loop
                muted
                autoPlay
                playsInline
                // @ts-expect-error - typescript doesn't know about fetchPriority for video elements
                fetchPriority="high"
                src="/videos/timelapse.mp4"
                aria-label={t`Timelapse demonstration of building a CV 2.0 with ${APP_NAME}`}
                className="pointer-events-none aspect-video w-full object-cover"
              />
            </div>
          </CometCard>
        </motion.div>
      </div>

      <HeroMarquee />
    </section>
  );
}
