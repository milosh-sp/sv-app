import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ArrowRightIcon, SealCheckIcon, SparkleIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";

import { CometCard } from "@/components/animation/comet-card";
import { Spotlight } from "@/components/animation/spotlight";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { HeroVisual } from "./hero-visual";

export function Hero() {
  return (
    <section
      id="hero"
      className="relative flex min-h-svh w-full items-center justify-center overflow-hidden border-b py-24"
    >
      <Spotlight />

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-12">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-12">
          <div className="xs:px-0 mx-auto flex max-w-2xl flex-col items-center gap-y-6 text-center lg:mx-0 lg:items-start lg:text-start">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.55 }}
              style={{ willChange: "transform, opacity" }}
            ></motion.div>

            {/* Headline */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.7 }}
              style={{ willChange: "transform, opacity" }}
            >
              <Trans>
                <p className="font-medium tracking-tight text-muted-foreground md:text-lg">Your skills, finally,</p>
                <h1 className="mt-1 text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
                  Proven. Not just claimed.
                </h1>
              </Trans>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.75 }}
              style={{ willChange: "transform, opacity" }}
            >
              <Badge variant="secondary" className="h-auto gap-1.5 px-3 py-0.5">
                <SparkleIcon aria-hidden="true" className="size-3.5" weight="fill" />
                <Trans>Don't chase. Attract.</Trans>
              </Badge>
            </motion.div>

            {/* Description */}
            <motion.p
              className="max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.82 }}
              style={{ willChange: "transform, opacity" }}
            >
              <Trans>
                Build a living profile backed by real evidence. Get your skills endorsed by domain experts in short,
                practical reviews — and let opportunities come to you.
              </Trans>
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row sm:justify-center sm:gap-4 lg:justify-start"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.95 }}
              style={{ willChange: "transform, opacity" }}
            >
              <Button
                size="lg"
                nativeButton={false}
                className="group relative overflow-hidden px-4"
                render={
                  <Link to="/dashboard">
                    <span className="relative z-10 flex items-center gap-2">
                      <Trans>Verify my skills</Trans>
                      <ArrowRightIcon
                        aria-hidden="true"
                        className="size-4 transition-transform group-hover:translate-x-0.5"
                      />
                    </span>
                  </Link>
                }
              />

              <Button
                size="lg"
                variant="ghost"
                className="gap-2 px-4"
                nativeButton={false}
                render={
                  <a href="#how-it-works" aria-label={t`See how verification works`}>
                    <SealCheckIcon aria-hidden="true" className="size-4" />
                    <Trans>See how it works</Trans>
                  </a>
                }
              />
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, ease: "easeOut" }}
            style={{ willChange: "transform, opacity" }}
          >
            <CometCard glareOpacity={0} className="3xl:max-w-7xl relative w-full max-w-4xl px-8 md:px-12 lg:px-0">
              <HeroVisual />
            </CometCard>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator - decorative */}
      <motion.div
        aria-hidden="true"
        role="presentation"
        className="absolute inset-s-1/2 bottom-8 -translate-x-1/2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.25, duration: 0.7 }}
      >
        <motion.div
          className="flex h-8 w-5 items-start justify-center rounded-full border border-muted-foreground/30 p-1.5"
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          style={{ willChange: "transform" }}
        >
          <motion.div className="h-1.5 w-1 rounded-full bg-muted-foreground/50" />
        </motion.div>
      </motion.div>
    </section>
  );
}
