import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
  BrainIcon,
  CompassIcon,
  EyeSlashIcon,
  type Icon,
  QrCodeIcon,
  SealCheckIcon,
  TargetIcon,
} from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useMemo } from "react";

import { cn } from "@/utils/style";

type Feature = {
  id: string;
  icon: Icon;
  title: string;
  description: string;
};

type FeatureCardProps = Feature;

const getFeatures = (): Feature[] => [
  {
    id: "verified-skills",
    icon: SealCheckIcon,
    title: t`Verified skill badges`,
    description: t`Earn peer-endorsed badges from domain experts — turn claims into evidence employers can trust at a glance.`,
  },
  {
    id: "bias-free-review",
    icon: EyeSlashIcon,
    title: t`Anonymous, bias-free review`,
    description: t`Reviewers don't see who they're assessing, so your skills are judged on their merit — not your background.`,
  },
  {
    id: "passive-discovery",
    icon: TargetIcon,
    title: t`Passive discovery`,
    description: t`Stop chasing. Companies reach out directly to candidates whose verified skills match their requirements.`,
  },
  {
    id: "personality-fit",
    icon: BrainIcon,
    title: t`Personality & culture fit`,
    description: t`Combine verified skills with research-backed personality insights so teams hire for both capability and fit.`,
  },
  {
    id: "share-anywhere",
    icon: QrCodeIcon,
    title: t`Share anywhere, instantly`,
    description: t`A unique QR code and public link make your profile shareable in person, online, and in recruiter searches.`,
  },
  {
    id: "growth-feedback",
    icon: CompassIcon,
    title: t`Growth-focused feedback`,
    description: t`Every assessment comes with actionable feedback, so you level up even when you're already getting hired.`,
  },
];

function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <motion.div
      className={cn(
        "group relative flex min-h-48 flex-col gap-4 overflow-hidden border-b bg-background p-6 transition-[background-color] duration-300",
        "not-nth-[2n]:border-r xl:not-nth-[3n]:border-r",
        "hover:bg-secondary/30",
      )}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      whileHover={{ y: -3, scale: 1.01 }}
      whileTap={{ scale: 0.995 }}
      style={{ willChange: "transform, opacity" }}
    >
      {/* Hover gradient overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />

      {/* Icon */}
      <div aria-hidden="true" className="relative">
        <div className="inline-flex rounded-md bg-primary/5 p-2.5 text-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
          <Icon size={24} weight="thin" />
        </div>
      </div>

      {/* Content */}
      <div className="relative flex flex-col gap-y-1.5">
        <h3 className="text-base font-semibold tracking-tight transition-colors group-hover:text-primary">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </motion.div>
  );
}

export function Features() {
  const features = useMemo(() => getFeatures(), []);

  return (
    <section id="features">
      {/* Header */}
      <motion.div
        className="space-y-4 p-4 md:p-8 xl:py-16"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45 }}
        style={{ willChange: "transform, opacity" }}
      >
        <h2 className="text-2xl font-semibold tracking-tight md:text-4xl xl:text-5xl">
          <Trans>Why candidates choose us</Trans>
        </h2>

        <p className="max-w-2xl leading-relaxed text-muted-foreground">
          <Trans>
            A profile that reflects what you can actually do — verified by people who know what they're looking at, and
            built to travel with you wherever you go.
          </Trans>
        </p>
      </motion.div>

      {/* Features Grid */}
      <div className="xs:grid-cols-2 grid grid-cols-1 border-t xl:grid-cols-3">
        {features.map((feature) => (
          <FeatureCard key={feature.id} {...feature} />
        ))}
      </div>
    </section>
  );
}
