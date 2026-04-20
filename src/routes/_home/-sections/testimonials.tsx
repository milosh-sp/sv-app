import { Trans } from "@lingui/react/macro";
import { motion } from "motion/react";
import { useMemo } from "react";

const testimonials: string[] = [
  "Getting my skills verified felt real — a practical assignment, actionable feedback, and a badge I could share immediately. Recruiters reached out within days.",

  "Skill Verdict turned my CV into actual evidence. Companies stopped asking whether I could do the work and started asking when I could start.",

  "The anonymous review process makes it fair. I focused on the problem, not on selling myself, and came out with a verified skill badge I'm proud of.",

  "As a Guru, verifying candidates on Skill Verdict is one of the most rewarding things I do — I earn for my time and help someone get a fair shot at their next role.",

  "I love that my public CV2.0 only shows what I want it to. Employers see verified skills, not buzzwords, and the QR code makes sharing at events effortless.",

  "A lot of hiring platforms promise to find great talent. Skill Verdict is the first one that actually shows us what each candidate can do.",

  "Going through the verification process gave me real feedback I could act on. I levelled up, re-verified, and landed a role in a team I genuinely enjoy.",

  "Sharing my CV2.0 link in applications has been a game-changer — it's dynamic, it's verifiable, and it finally matches how modern hiring should work.",
];

type TestimonialCardProps = {
  testimonial: string;
};

function TestimonialCard({ testimonial }: TestimonialCardProps) {
  return (
    <motion.div
      className="group relative w-[320px] shrink-0 sm:w-[360px] md:w-[400px]"
      initial={{ scale: 1 }}
      whileHover={{ y: -3, scale: 1.02 }}
      whileTap={{ scale: 0.995 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      style={{ willChange: "transform" }}
    >
      <div className="relative flex h-full flex-col rounded-md border bg-card p-5 shadow-sm transition-shadow duration-300 group-hover:shadow-xl">
        <p className="flex-1 leading-relaxed text-muted-foreground">"{testimonial}"</p>
      </div>
    </motion.div>
  );
}

type MarqueeRowProps = {
  rowId: string;
  testimonials: string[];
  direction: "left" | "right";
  duration?: number;
};

function MarqueeRow({ testimonials, rowId, direction, duration = 30 }: MarqueeRowProps) {
  const animateX = direction === "left" ? ["0%", "-50%"] : ["-50%", "0%"];

  return (
    <motion.div
      className="flex items-start gap-x-4 will-change-transform"
      animate={{ x: animateX }}
      transition={{ x: { repeat: Infinity, repeatType: "loop", duration, ease: "linear" } }}
    >
      {testimonials.map((testimonial, index) => (
        <TestimonialCard key={`${rowId}-${index}`} testimonial={testimonial} />
      ))}
    </motion.div>
  );
}

export function Testimonials() {
  const { row1, row2 } = useMemo(() => {
    const half = Math.ceil(testimonials.length / 2);
    const firstHalf = testimonials.slice(0, half);
    const secondHalf = testimonials.slice(half);

    return {
      row1: [...firstHalf, ...firstHalf],
      row2: [...secondHalf, ...secondHalf],
    };
  }, []);

  return (
    <section id="testimonials" className="overflow-hidden py-12 md:py-16 xl:py-20">
      <motion.div
        className="mb-10 flex flex-col items-center space-y-4 px-4 text-center md:px-8"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-2xl font-semibold tracking-tight md:text-4xl xl:text-5xl">
          <Trans>Testimonials</Trans>
        </h2>

        <p className="max-w-4xl leading-relaxed text-balance text-muted-foreground">
          <Trans>
            Candidates, Gurus, and hiring teams share how Skill Verdict changed the way they prove and evaluate skills —
            moving the conversation from keywords to real, verified evidence.
          </Trans>
        </p>
      </motion.div>

      <div className="relative">
        {/* Left fade */}
        <div className="pointer-events-none absolute inset-s-0 top-0 bottom-0 z-10 w-16 bg-linear-to-r from-background to-transparent sm:w-24 md:w-32 lg:w-48" />

        {/* Right fade */}
        <div className="pointer-events-none absolute inset-e-0 top-0 bottom-0 z-10 w-16 bg-linear-to-l from-background to-transparent sm:w-24 md:w-32 lg:w-48" />

        <div className="flex flex-col gap-y-6">
          <MarqueeRow testimonials={row1} rowId="row1" direction="left" duration={50} />
          <MarqueeRow testimonials={row2} rowId="row2" direction="right" duration={55} />
        </div>
      </div>
    </section>
  );
}
