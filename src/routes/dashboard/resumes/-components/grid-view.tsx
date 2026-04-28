import { AnimatePresence, motion } from "motion/react";

import type { RouterOutput } from "@/integrations/orpc/client";

import { ResumeCard } from "./cards/resume-card";

type Resume = RouterOutput["resume"]["list"][number];

type Props = {
  resumes: Resume[];
};

export function GridView({ resumes }: Props) {
  return (
    <div className="3xl:grid-cols-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      <AnimatePresence initial={false} mode="popLayout">
        {resumes?.map((resume, index) => (
          <motion.div
            layout
            key={resume.id}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{
              opacity: 0,
              y: -20,
              filter: "blur(8px)",
            }}
            transition={{ duration: 0.2, delay: Math.min(0.12, index * 0.02), ease: "easeOut" }}
            style={{ willChange: "transform, opacity" }}
          >
            <ResumeCard resume={resume} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
