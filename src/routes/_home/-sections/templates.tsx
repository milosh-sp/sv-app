import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { motion } from "motion/react";

import { templates } from "@/dialogs/resume/template/data";

type LayoutConcept = {
  id: string;
  focus: string;
  title: string;
  description: string;
  imageUrl: string;
};

const getLayoutConcepts = (): LayoutConcept[] => [
  {
    id: "northline",
    focus: t`Proof-first`,
    title: t`Northline`,
    description: t`Hero statement up top, verified skills as the spine — built for reviewers who scan in seconds.`,
    imageUrl: templates.bronzor.imageUrl,
  },
  {
    id: "relay",
    focus: t`Signal density`,
    title: t`Relay`,
    description: t`Compact signal row for endorsements and recency — less chrome, more "what passed".`,
    imageUrl: templates.chikorita.imageUrl,
  },
  {
    id: "arc",
    focus: t`Story arc`,
    title: t`Arc`,
    description: t`Timeline-forward narrative with milestones; good when your evidence has a clear before/after.`,
    imageUrl: templates.rhyhorn.imageUrl,
  },
  {
    id: "cluster",
    focus: t`Skill clusters`,
    title: t`Cluster`,
    description: t`Grouped capabilities with micro-labels — shows breadth without a wall of bullet points.`,
    imageUrl: templates.azurill.imageUrl,
  },
  {
    id: "ledger",
    focus: t`Two-pane`,
    title: t`Ledger`,
    description: t`Split identity and evidence panes; keeps personality context beside hard verification.`,
    imageUrl: templates.ditgar.imageUrl,
  },
  {
    id: "pulse",
    focus: t`Compact`,
    title: t`Pulse`,
    description: t`Tight vertical rhythm for mobile sharing — still readable when the viewport is narrow.`,
    imageUrl: templates.kakuna.imageUrl,
  },
];

function LayoutPreview({ imageUrl, title }: { imageUrl: string; title: string }) {
  return (
    <div className="relative mb-4 aspect-4/3 overflow-hidden rounded-xl bg-muted ring-1 ring-border/40">
      <img
        src={imageUrl}
        alt={title}
        className="size-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.03]"
        loading="lazy"
        decoding="async"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-linear-to-t from-background/20 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
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
      <LayoutPreview imageUrl={concept.imageUrl} title={concept.title} />
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
            Pick a presentation that puts verification and outcomes first. Each card shows a real export layout from
            the builder — same document you share, with structure tuned for how people actually skim proof.
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
