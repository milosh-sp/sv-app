import type { Icon } from "@phosphor-icons/react";

import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { FileTextIcon, UsersIcon } from "@phosphor-icons/react";
import { useQueries } from "@tanstack/react-query";
import { motion } from "motion/react";

import { CountUp } from "@/components/animation/count-up";
import { orpc } from "@/integrations/orpc/client";

import { HOME_ACCENT } from "../-styles";

type Statistic = {
  id: string;
  label: string;
  value: number;
  icon: Icon;
  prefix: string;
  accent: string;
};

const getStatistics = (userCount: number, resumeCount: number): Statistic[] => [
  {
    id: "users",
    label: t`People who stopped chasing`,
    value: userCount,
    icon: UsersIcon,
    prefix: "01",
    accent: HOME_ACCENT.lime,
  },
  {
    id: "resumes",
    label: t`CV 2.0s built`,
    value: resumeCount,
    icon: FileTextIcon,
    prefix: "02",
    accent: HOME_ACCENT.magenta,
  },
];

type StatisticCardProps = {
  statistic: Statistic;
  index: number;
};

function StatisticCard({ statistic, index }: StatisticCardProps) {
  const Icon = statistic.icon;

  return (
    <motion.div
      className="group relative flex flex-col justify-between gap-8 p-6 md:p-10 xl:p-14"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: "easeOut" }}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs tracking-[0.3em] text-muted-foreground uppercase">
          — {statistic.prefix}
        </span>

        <motion.div
          aria-hidden="true"
          className="flex size-10 items-center justify-center border-2 border-foreground"
          style={{ backgroundColor: statistic.accent, color: HOME_ACCENT.ink }}
          whileHover={{ rotate: -8, scale: 1.05 }}
          transition={{ type: "spring", stiffness: 400, damping: 18 }}
        >
          <Icon size={20} weight="bold" />
        </motion.div>
      </div>

      <div>
        <CountUp
          key={statistic.id}
          separator=","
          duration={0.9}
          to={statistic.value}
          className="block text-6xl leading-none font-black tracking-tighter md:text-7xl xl:text-8xl"
        />

        <p className="mt-4 font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase md:text-sm">
          {statistic.label}
        </p>
      </div>
    </motion.div>
  );
}

export function Statistics() {
  const [userCountResult, resumeCountResult] = useQueries({
    queries: [orpc.statistics.user.getCount.queryOptions(), orpc.statistics.resume.getCount.queryOptions()],
  });

  if (!userCountResult.data || !resumeCountResult.data) return null;

  return (
    <section id="statistics" aria-labelledby="stats-heading" className="border-t-2 border-foreground">
      <h2 id="stats-heading" className="sr-only">
        {t`Application Statistics`}
      </h2>

      <div className="relative grid grid-cols-1 divide-y-2 divide-foreground sm:grid-cols-[auto_1fr_1fr] sm:divide-y-0 sm:divide-x-2">
        <div
          className="hidden flex-col justify-between p-6 text-background sm:flex sm:w-48 md:w-56 md:p-10"
          style={{ backgroundColor: HOME_ACCENT.ink, color: "#fafafa" }}
        >
          <span className="font-mono text-[0.65rem] tracking-[0.3em] uppercase opacity-70">
            <Trans>By the numbers</Trans>
          </span>
          <span className="text-3xl leading-none font-black md:text-4xl">
            <Trans>Receipts.</Trans>
          </span>
        </div>

        {getStatistics(userCountResult.data, resumeCountResult.data).map((statistic, index) => (
          <StatisticCard key={statistic.id} statistic={statistic} index={index} />
        ))}
      </div>
    </section>
  );
}
