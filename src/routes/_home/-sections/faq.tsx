import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { motion } from "motion/react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { buttonVariants } from "@/components/ui/button";
import { SKILL_VERDICT_LINKS } from "@/constants/brand";
import { cn } from "@/utils/style";

type FAQItemData = {
  question: string;
  answer: React.ReactNode;
};

const getFaqItems = (): FAQItemData[] => [
  {
    question: t`How does the verification process work?`,
    answer: t`Every submission is reviewed by expert Gurus with real hiring backgrounds. You'll complete practical assessments, get actionable feedback, and once verified your skills are recorded and easily shareable by QR code or direct link — ready for employers to see in seconds.`,
  },
  {
    question: t`How long does it take to get my skills verified?`,
    answer: t`Most verifications take just 1–3 days. Timing depends on the skills you choose and Guru availability, but we keep it fast so you can move forward in your job search right away.`,
  },
  {
    question: t`How is my data protected?`,
    answer: t`Your privacy is at the core of Skill Verdict. Only your assigned verifiers can see your code and assignment solutions. Your public CV2.0 displays only the skills you choose, and you always control what is visible to employers.`,
  },
  {
    question: t`Can I update my skills after verification?`,
    answer: t`Absolutely. Add new skills anytime, or request re-verification as you level up — your CV2.0 evolves with your career.`,
  },
  {
    question: t`What if I'm not happy with my verification outcome?`,
    answer: t`If you feel your skills were not evaluated properly, you can file a complaint. We'll review your case and, if needed, connect you to a different Guru for a fresh, unbiased assessment.`,
  },
  {
    question: t`Can I become a Guru and earn by verifying?`,
    answer: (
      <Trans>
        Yes. Once you've successfully verified your own skills, you can apply to become a Guru — share your expertise,
        help others grow, and earn income each time you verify members' skills.{" "}
        <a
          href={SKILL_VERDICT_LINKS.verifier}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "link", className: "h-auto px-0!" })}
        >
          Learn more about becoming a Guru
          <span className="sr-only"> (opens in new tab)</span>
        </a>
        .
      </Trans>
    ),
  },
  {
    question: t`How do I share my CV2.0?`,
    answer: t`Share your CV2.0 via a unique public URL, a QR code, a PDF export, or by adding it to your Apple or Google Wallet. The choice is yours.`,
  },
  {
    question: t`Can I customize the templates?`,
    answer: t`Yes. Every template is fully customizable. You can change colors, fonts, spacing, and even write custom CSS for complete control over your CV2.0's appearance.`,
  },
];

export function FAQ() {
  const faqItems = getFaqItems();

  return (
    <section
      id="frequently-asked-questions"
      className="flex flex-col gap-x-16 gap-y-6 p-4 md:p-8 lg:flex-row lg:gap-x-18 xl:py-16"
    >
      <motion.h2
        className={cn(
          "flex-1 text-2xl font-semibold tracking-tight md:text-4xl xl:text-5xl",
          "flex shrink-0 flex-wrap items-center gap-x-1.5 lg:flex-col lg:items-start",
        )}
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45 }}
        style={{ willChange: "transform, opacity" }}
      >
        <Trans context="Every word needs to be wrapped in a tag">
          <span>Frequently</span>
          <span>Asked</span>
          <span>Questions</span>
        </Trans>
      </motion.h2>

      <motion.div
        className="max-w-2xl flex-2 lg:ml-auto 2xl:max-w-3xl"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45, delay: 0.08 }}
        style={{ willChange: "transform, opacity" }}
      >
        <Accordion multiple>
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
      className="last:border-b"
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.24, delay: Math.min(0.16, index * 0.03) }}
      style={{ willChange: "transform, opacity" }}
    >
      <AccordionItem value={item.question} className="group border-t">
        <AccordionTrigger className="py-5">{item.question}</AccordionTrigger>
        <AccordionContent className="pb-5 leading-relaxed text-muted-foreground">{item.answer}</AccordionContent>
      </AccordionItem>
    </motion.div>
  );
}
