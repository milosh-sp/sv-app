import { Trans } from "@lingui/react/macro";
import { motion } from "motion/react";
import { useMemo } from "react";

import type { TemplateMetadata } from "@/dialogs/resume/template/data";

import { templates } from "@/dialogs/resume/template/data";

import { HOME_ACCENT } from "../-styles";

type TemplateItemProps = {
  metadata: TemplateMetadata;
};

function TemplateItem({ metadata }: TemplateItemProps) {
  return (
    <motion.div
      className="group relative shrink-0"
      initial={{ scale: 1, zIndex: 10 }}
      whileHover={{ scale: 1.06, zIndex: 20 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      style={{ willChange: "transform" }}
    >
      <div
        aria-hidden="true"
        className="absolute -inset-0.5 -z-10 translate-x-1.5 translate-y-1.5 border-2 border-foreground"
        style={{ backgroundColor: HOME_ACCENT.lime }}
      />

      <div className="relative aspect-page w-48 overflow-hidden border-2 border-foreground bg-card transition-all duration-300 sm:w-56 md:w-64 lg:w-72">
        <img src={metadata.imageUrl} alt={metadata.name} className="size-full object-cover" />

        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <div className="absolute inset-x-0 bottom-0 translate-y-full p-4 transition-transform duration-300 group-hover:translate-y-0">
          <p className="font-mono text-[0.75rem] tracking-[0.2em] text-white uppercase drop-shadow-lg">
            {metadata.name}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

type MarqueeRowProps = {
  templates: Array<[string, TemplateMetadata]>;
  rowId: string;
  direction: "left" | "right";
  duration?: number;
};

function MarqueeRow({ templates, rowId, direction, duration = 40 }: MarqueeRowProps) {
  const animateX = direction === "left" ? ["0%", "-50%"] : ["-50%", "0%"];

  return (
    <motion.div
      className="flex gap-x-4 will-change-transform sm:gap-x-6"
      animate={{ x: animateX }}
      transition={{
        x: {
          repeat: Infinity,
          repeatType: "loop",
          duration,
          ease: "linear",
        },
      }}
    >
      {templates.map(([template, metadata], index) => (
        <TemplateItem key={`${rowId}-${template}-${index}`} metadata={metadata} />
      ))}
    </motion.div>
  );
}

function LabelStrip() {
  const items = ["12 TEMPLATES", "FULLY CUSTOMIZABLE", "CUSTOM CSS", "12 TEMPLATES", "FULLY CUSTOMIZABLE", "CUSTOM CSS"];

  return (
    <div
      aria-hidden="true"
      className="overflow-hidden border-y-2 border-foreground"
      style={{ backgroundColor: HOME_ACCENT.lime, color: HOME_ACCENT.ink }}
    >
      <motion.div
        className="flex w-max items-center gap-8 py-2 font-mono text-xs tracking-[0.3em] whitespace-nowrap uppercase"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
      >
        {[...items, ...items, ...items].map((item, i) => (
          <span key={i} className="flex items-center gap-8">
            <span>{item}</span>
            <span aria-hidden="true">✦</span>
          </span>
        ))}
      </motion.div>
    </div>
  );
}

export function Templates() {
  const { row1, row2 } = useMemo(() => {
    const entries = Object.entries(templates);
    const half = Math.ceil(entries.length / 2);
    const firstHalf = entries.slice(0, half);
    const secondHalf = entries.slice(half);

    return {
      row1: [...firstHalf, ...firstHalf],
      row2: [...secondHalf, ...secondHalf],
    };
  }, []);

  return (
    <section id="templates" className="overflow-hidden border-t-2 border-foreground">
      <motion.div
        className="grid gap-6 p-4 md:grid-cols-[1fr_auto] md:items-end md:gap-12 md:p-10 xl:p-14"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.35 }}
        style={{ willChange: "transform, opacity" }}
      >
        <div className="space-y-4">
          <span className="font-mono text-[0.7rem] tracking-[0.3em] text-muted-foreground uppercase">
            — <Trans>Section 03 / Templates</Trans>
          </span>

          <h2 className="text-4xl leading-[0.95] font-black tracking-tighter md:text-6xl xl:text-7xl">
            <Trans>
              Pick a <span className="font-serif italic">look,</span> make it yours.
            </Trans>
          </h2>

          <p className="max-w-2xl leading-relaxed text-muted-foreground">
            <Trans>
              Explore a diverse selection of templates, each designed to fit different styles, professions, and
              personalities. Customize colors, fonts, spacing, or write your own CSS.
            </Trans>
          </p>
        </div>
      </motion.div>

      <LabelStrip />

      <div className="relative -rotate-2 py-10 sm:-rotate-3 md:py-14 lg:-rotate-4">
        <div className="flex min-h-[280px] flex-col gap-y-4 sm:min-h-[320px] sm:gap-y-6 md:min-h-[380px] lg:min-h-[420px]">
          <MarqueeRow templates={row1} rowId="row1" direction="left" duration={45} />
          <MarqueeRow templates={row2} rowId="row2" direction="right" duration={50} />
        </div>
      </div>

      <LabelStrip />
    </section>
  );
}
