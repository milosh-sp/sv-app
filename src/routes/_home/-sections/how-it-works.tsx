import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
  CheckCircleIcon,
  type Icon,
  IdentificationCardIcon,
  SealCheckIcon,
  UserCircleCheckIcon,
} from "@phosphor-icons/react";
import { motion } from "motion/react";

type Step = {
  id: string;
  number: string;
  icon: Icon;
  title: string;
  description: string;
};

const getSteps = (): Step[] => [
  {
    id: "profile",
    number: "01",
    icon: IdentificationCardIcon,
    title: t`Build your profile`,
    description: t`Connect your professional accounts and portfolio to instantly build a living, evidence-backed profile that showcases real experience.`,
  },
  {
    id: "prepare",
    number: "02",
    icon: CheckCircleIcon,
    title: t`Pick skills to verify`,
    description: t`Select the skills you want endorsed and choose a reviewer for a personalized, scenario-based assessment.`,
  },
  {
    id: "verify",
    number: "03",
    icon: UserCircleCheckIcon,
    title: t`Complete the assessment`,
    description: t`Receive a practical assignment from your reviewer, submit your work, and get actionable feedback in a real conversation.`,
  },
  {
    id: "verdict",
    number: "04",
    icon: SealCheckIcon,
    title: t`Earn your verdict`,
    description: t`Pass the review to earn a verified skill badge, boost your profile visibility, and let opportunities come to you.`,
  },
];

type StepCardProps = {
  step: Step;
  index: number;
};

function StepCard({ step, index }: StepCardProps) {
  const Icon = step.icon;

  return (
    <motion.div
      className="group relative flex flex-col gap-4 rounded-xl bg-card p-6 shadow-sm transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-md"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: "easeOut" }}
      style={{ willChange: "transform, opacity" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-mono font-medium tracking-widest text-muted-foreground">{step.number}</span>
        <div
          aria-hidden="true"
          className="inline-flex rounded-lg bg-primary/5 p-2.5 text-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary"
        >
          <Icon size={24} weight="thin" />
        </div>
      </div>

      <div className="flex flex-col gap-y-1.5">
        <h3 className="text-base font-semibold tracking-tight transition-colors group-hover:text-primary">
          {step.title}
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
      </div>
    </motion.div>
  );
}

export function HowItWorks() {
  const steps = getSteps();

  return (
    <section id="how-it-works">
      <motion.div
        className="space-y-4 p-4 md:p-8 xl:py-8"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45 }}
        style={{ willChange: "transform, opacity" }}
      >
        <h2 className="text-2xl font-semibold tracking-tight md:text-4xl xl:text-5xl">
          <Trans>How it works</Trans>
        </h2>

        <p className="max-w-2xl leading-relaxed text-muted-foreground">
          <Trans>
            Four simple steps to turn your claims into evidence. No keyword stuffing, no job-title theatre — just
            practical assessments reviewed by domain experts.
          </Trans>
        </p>
      </motion.div>

      <div className="xs:grid-cols-2 grid grid-cols-1 gap-6 xl:grid-cols-4">
        {steps.map((step, index) => (
          <StepCard key={step.id} step={step} index={index} />
        ))}
      </div>
    </section>
  );
}
