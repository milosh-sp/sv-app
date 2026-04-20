import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";

import { TextMaskEffect } from "@/components/animation/text-mask";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/constants/brand";

import { HOME_ACCENT, HOME_GRID_BG } from "../-styles";

export function Prefooter() {
  return (
    <section id="prefooter" className="relative overflow-hidden border-t-2 border-foreground">
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ backgroundColor: HOME_ACCENT.ink, color: "#fafafa" }}
      />

      <div aria-hidden="true" className={`absolute inset-0 opacity-40 ${HOME_GRID_BG} mix-blend-screen`} />

      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/4 size-128 rounded-full blur-3xl"
        style={{ backgroundColor: HOME_ACCENT.magentaSoft }}
        animate={{ x: [0, 40, 0], y: [0, 20, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -bottom-32 size-128 rounded-full blur-3xl"
        style={{ backgroundColor: HOME_ACCENT.limeSoft }}
        animate={{ x: [0, -30, 0], y: [0, -20, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative space-y-10 px-4 py-20 md:py-28 lg:py-32">
        <TextMaskEffect
          aria-hidden="true"
          text={APP_NAME}
          accentFrom={HOME_ACCENT.lime}
          accentTo={HOME_ACCENT.magenta}
          strokeClassName="stroke-white/25"
          className="hidden md:block"
        />

        <motion.div
          className="mx-auto flex max-w-4xl flex-col items-center gap-8 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          style={{ willChange: "transform, opacity" }}
        >
          <span className="inline-flex items-center gap-2 border-2 border-white/40 px-3 py-1 font-mono text-[0.7rem] tracking-[0.25em] text-white uppercase">
            <span className="size-1.5 rounded-full" style={{ backgroundColor: HOME_ACCENT.lime }} />
            <Trans>Ready when you are</Trans>
          </span>

          <h2 className="text-5xl leading-[0.95] font-black tracking-tighter text-white md:text-7xl lg:text-[6rem]">
            <Trans>
              Don't chase. <span className="font-serif italic">Attract.</span>
            </Trans>
          </h2>

          <p className="max-w-2xl leading-relaxed text-white/70 md:text-lg">
            <Trans>
              Skill Verdict brings skills and personality together so you're understood as a person, not just a list of
              keywords. Build your CV 2.0, get your abilities peer-verified, and let employers come to you.
            </Trans>
          </p>

          <div className="mt-2 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Button
              size="lg"
              nativeButton={false}
              aria-label={t`Build my CV 2.0`}
              className="group h-12 gap-2 border-2 border-white px-6 font-mono text-xs tracking-[0.16em] uppercase shadow-[4px_4px_0_0_#ffffff] transition-[transform,box-shadow] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#ffffff]"
              style={{ backgroundColor: HOME_ACCENT.lime, color: HOME_ACCENT.ink }}
              render={
                <Link to="/dashboard">
                  <Trans>Build my CV 2.0</Trans>
                  <ArrowRightIcon
                    aria-hidden="true"
                    className="size-4 transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              }
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
