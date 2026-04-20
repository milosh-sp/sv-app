import { Trans } from "@lingui/react/macro";
import { motion } from "motion/react";

import { TextMaskEffect } from "@/components/animation/text-mask";
import { APP_NAME } from "@/constants/brand";

export function Prefooter() {
  return (
    <section id="prefooter" className="relative overflow-hidden py-16 md:py-24">
      {/* Background decoration */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-s-1/4 top-0 size-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute inset-e-1/4 bottom-0 size-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative space-y-8">
        <TextMaskEffect aria-hidden="true" text={APP_NAME} className="hidden md:block" />

        <motion.div
          className="mx-auto max-w-3xl space-y-8 px-6 text-center md:px-8 xl:px-0"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          style={{ willChange: "transform, opacity" }}
        >
          <h2 className="text-2xl font-bold tracking-tight md:text-4xl">
            <Trans>Don't chase, attract.</Trans>
          </h2>

          <p className="leading-relaxed text-muted-foreground">
            <Trans>
              Skill Verdict brings skills and personality together so you're understood as a person, not just a list of
              keywords. Build your CV2.0, get your abilities peer-verified, and let employers come to you.
            </Trans>
          </p>
        </motion.div>
      </div>
    </section>
  );
}
