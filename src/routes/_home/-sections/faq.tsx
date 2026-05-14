import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { motion } from "motion/react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

type FAQItemData = {
  question: string;
  answer: React.ReactNode;
};

const getFaqItems = (): FAQItemData[] => [
  {
    question: t`How does skill verification work?`,
    answer: t`You pick the skills you want to endorse and a reviewer with relevant expertise. They assign a short, practical assessment, review your submission, and share actionable feedback. If you pass, the skill is added to your profile as a verified badge.`,
  },
  {
    question: t`How long does a verification take?`,
    answer: t`Most verifications wrap up in 1–3 days depending on the skill and reviewer availability — no weeks of waiting around.`,
  },
  {
    question: t`Is the review really unbiased?`,
    answer: t`Reviewers evaluate your submission without seeing your name, employer, or background. If you're ever unhappy with an outcome, you can request a second opinion from a different reviewer.`,
  },
  {
    question: t`Who can see my submissions and results?`,
    answer: t`Only your assigned reviewer sees the assignments you submit. On your public profile, you decide which verified skills to display — everything else stays private.`,
  },
  {
    question: t`Can I update my profile and re-verify skills later?`,
    answer: t`Yes. Add or remove skills any time, and request re-verification as you level up. Your profile is designed to evolve with your career.`,
  },
];

export function FAQ() {
  const faqItems = getFaqItems();

  return (
    <section
      id="frequently-asked-questions"
      className="mx-auto flex w-full max-w-4xl flex-col gap-y-6 p-4 md:p-8 xl:py-8"
    >
      <motion.h2
        className="text-center text-2xl font-semibold tracking-tight md:text-4xl xl:text-5xl"
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45 }}
        style={{ willChange: "transform, opacity" }}
      >
        <Trans>
         Frequently
         Asked
         Questions
        </Trans>
      </motion.h2>

      <motion.div
        className="mx-auto w-full max-w-3xl"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45, delay: 0.08 }}
        style={{ willChange: "transform, opacity" }}
      >
        <Accordion multiple className="space-y-4">
          {faqItems.map((item, index) => (
            <FAQItemComponent key={item.question} item={item} index={index} />
          ))}
        </Accordion>
      </motion.div>
    </section>
  );
}

type FAQItemComponentProps = {
  item: FAQItemData;
  index: number;
};

function FAQItemComponent({ item, index }: FAQItemComponentProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.24, delay: Math.min(0.16, index * 0.03) }}
      style={{ willChange: "transform, opacity" }}
    >
      <AccordionItem value={item.question} className="group rounded-xl bg-card px-5 shadow-sm">
        <AccordionTrigger className="py-5 text-base hover:no-underline">{item.question}</AccordionTrigger>
        <AccordionContent className="pb-5 leading-relaxed text-muted-foreground">{item.answer}</AccordionContent>
      </AccordionItem>
    </motion.div>
  );
}
