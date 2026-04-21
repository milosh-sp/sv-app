import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { motion } from "motion/react";

import { cn } from "@/utils/style";

type LayoutConcept = {
  id: string;
  focus: string;
  title: string;
  description: string;
  preview: "northline" | "relay" | "arc" | "cluster" | "ledger" | "pulse";
};

const getLayoutConcepts = (): LayoutConcept[] => [
  {
    id: "northline",
    focus: t`Proof-first`,
    title: t`Northline`,
    description: t`Hero statement up top, verified skills as the spine — built for reviewers who scan in seconds.`,
    preview: "northline",
  },
  {
    id: "relay",
    focus: t`Signal density`,
    title: t`Relay`,
    description: t`Compact signal row for endorsements and recency — less chrome, more “what passed”.`,
    preview: "relay",
  },
  {
    id: "arc",
    focus: t`Story arc`,
    title: t`Arc`,
    description: t`Timeline-forward narrative with milestones; good when your evidence has a clear before/after.`,
    preview: "arc",
  },
  {
    id: "cluster",
    focus: t`Skill clusters`,
    title: t`Cluster`,
    description: t`Grouped capabilities with micro-labels — shows breadth without a wall of bullet points.`,
    preview: "cluster",
  },
  {
    id: "ledger",
    focus: t`Two-pane`,
    title: t`Ledger`,
    description: t`Split identity and evidence panes; keeps personality context beside hard verification.`,
    preview: "ledger",
  },
  {
    id: "pulse",
    focus: t`Compact`,
    title: t`Pulse`,
    description: t`Tight vertical rhythm for mobile sharing — still readable when the viewport is narrow.`,
    preview: "pulse",
  },
];

function AbstractPreview({ variant, className }: { variant: LayoutConcept["preview"]; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex aspect-4/3 flex-col gap-2 rounded-xl bg-muted/50 p-3 ring-1 ring-border/40",
        className,
      )}
    >
      {variant === "northline" && (
        <>
          <div className="h-2 w-2/3 rounded-md bg-foreground/15" />
          <div className="h-1.5 w-1/3 rounded bg-muted-foreground/25" />
          <div className="mt-1 flex gap-1.5">
            <div className="h-6 flex-1 rounded-lg bg-primary/20" />
            <div className="h-6 flex-1 rounded-lg bg-muted-foreground/15" />
            <div className="h-6 flex-1 rounded-lg bg-muted-foreground/10" />
          </div>
          <div className="mt-auto space-y-1.5">
            <div className="h-2 w-full rounded bg-foreground/10" />
            <div className="h-2 w-5/6 rounded bg-foreground/10" />
          </div>
        </>
      )}
      {variant === "relay" && (
        <>
          <div className="flex items-center gap-2">
            <div className="size-7 shrink-0 rounded-full bg-primary/25" />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="h-2 w-1/2 rounded bg-foreground/15" />
              <div className="h-1.5 w-1/3 rounded bg-muted-foreground/20" />
            </div>
          </div>
          <div className="flex gap-1">
            {[0.85, 0.65, 0.45, 0.3].map((w, i) => (
              <div key={i} className="h-2 flex-1 rounded-sm bg-primary/30" style={{ opacity: w }} />
            ))}
          </div>
          <div className="mt-auto grid grid-cols-3 gap-1.5">
            <div className="h-8 rounded-lg bg-card shadow-sm ring-1 ring-border/30" />
            <div className="h-8 rounded-lg bg-card shadow-sm ring-1 ring-border/30" />
            <div className="h-8 rounded-lg bg-card shadow-sm ring-1 ring-border/30" />
          </div>
        </>
      )}
      {variant === "arc" && (
        <>
          <div className="flex gap-2">
            <div className="w-1 shrink-0 rounded-full bg-primary/35" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-2 w-3/4 rounded bg-foreground/12" />
              <div className="h-1.5 w-full rounded bg-muted-foreground/15" />
              <div className="h-1.5 w-11/12 rounded bg-muted-foreground/12" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="w-1 shrink-0 rounded-full bg-muted-foreground/20" />
            <div className="min-w-0 flex-1 space-y-2 pt-0.5">
              <div className="h-2 w-2/3 rounded bg-foreground/12" />
              <div className="h-1.5 w-full rounded bg-muted-foreground/12" />
            </div>
          </div>
        </>
      )}
      {variant === "cluster" && (
        <>
          <div className="h-2 w-1/2 rounded bg-foreground/12" />
          <div className="flex flex-wrap gap-1">
            {["a", "b", "c", "d", "e"].map((k) => (
              <div key={k} className="h-5 rounded-full bg-primary/15 px-3" />
            ))}
          </div>
          <div className="mt-auto flex gap-2">
            <div className="h-10 flex-1 rounded-xl bg-card ring-1 ring-border/35" />
            <div className="h-10 flex-1 rounded-xl bg-card ring-1 ring-border/35" />
          </div>
        </>
      )}
      {variant === "ledger" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5 rounded-lg bg-card/80 p-2 ring-1 ring-border/30">
              <div className="h-2 w-3/4 rounded bg-foreground/12" />
              <div className="h-1.5 w-full rounded bg-muted-foreground/12" />
              <div className="h-6 rounded-md bg-primary/15" />
            </div>
            <div className="space-y-1.5 rounded-lg bg-card/80 p-2 ring-1 ring-border/30">
              <div className="h-2 w-2/3 rounded bg-foreground/12" />
              <div className="h-1.5 w-full rounded bg-muted-foreground/12" />
              <div className="flex gap-1">
                <div className="h-4 flex-1 rounded bg-muted-foreground/15" />
                <div className="h-4 flex-1 rounded bg-muted-foreground/15" />
              </div>
            </div>
          </div>
        </>
      )}
      {variant === "pulse" && (
        <>
          <div className="h-2 w-3/5 rounded-md bg-foreground/14" />
          <div className="space-y-1">
            <div className="h-1.5 w-full rounded bg-muted-foreground/12" />
            <div className="h-1.5 w-11/12 rounded bg-muted-foreground/10" />
            <div className="h-1.5 w-4/5 rounded bg-muted-foreground/10" />
          </div>
          <div className="mt-1 flex gap-1.5">
            <div className="h-5 w-12 rounded-md bg-primary/25" />
            <div className="h-5 flex-1 rounded-md bg-muted-foreground/12" />
          </div>
        </>
      )}
    </div>
  );
}

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.06 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] as const },
  },
};

type LayoutCardProps = {
  concept: LayoutConcept;
};

function LayoutCard({ concept }: LayoutCardProps) {
  return (
    <motion.article
      variants={staggerItem}
      className="group flex flex-col rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border/30 transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-md md:p-6"
    >
      <AbstractPreview variant={concept.preview} className="mb-4" />
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{concept.focus}</p>
      <h3 className="mt-1.5 text-lg font-semibold tracking-tight">{concept.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{concept.description}</p>
    </motion.article>
  );
}

export function Templates() {
  const layouts = getLayoutConcepts();

  return (
    <section id="templates" className="p-4 md:p-8 xl:py-8">
      <motion.div
        className="space-y-4"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        style={{ willChange: "transform, opacity" }}
      >
        <h2 className="text-2xl font-semibold tracking-tight md:text-4xl xl:text-5xl">
          <Trans>Layouts for evidence, not decoration</Trans>
        </h2>

        <p className="max-w-2xl leading-relaxed text-muted-foreground">
          <Trans>
            Pick a presentation that puts verification and outcomes first. These are conceptual styles — abstract
            previews, not canned résumé clones — so your profile reads like a product, not a PDF template dump.
          </Trans>
        </p>
      </motion.div>

      <motion.div
        className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 xl:gap-8"
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-40px" }}
        style={{ willChange: "opacity" }}
      >
        {layouts.map((concept) => (
          <LayoutCard key={concept.id} concept={concept} />
        ))}
      </motion.div>
    </section>
  );
}
