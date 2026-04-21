import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
  BriefcaseIcon,
  CertificateIcon,
  CodeIcon,
  GraduationCapIcon,
  type Icon,
  SealCheckIcon,
  SparkleIcon,
  TranslateIcon,
  UserFocusIcon,
} from "@phosphor-icons/react";
import { motion } from "motion/react";

type VerifiedSkill = {
  label: string;
  verified?: boolean;
};

const skills: VerifiedSkill[] = [
  { label: "React", verified: true },
  { label: "TypeScript", verified: true },
  { label: "Node.js", verified: true },
  { label: "AWS", verified: true },
  { label: "Docker" },
  { label: "AI / ML" },
];

type SectionGroupProps = {
  icon: Icon;
  title: string;
  children: React.ReactNode;
};

function SectionGroup({ icon: IconComponent, title, children }: SectionGroupProps) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
        <IconComponent aria-hidden="true" size={14} weight="regular" />
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

export function HeroVisual() {
  return (
    <div
      aria-label={t`Preview of a verified candidate profile`}
      role="img"
      className="pointer-events-none relative size-full overflow-hidden rounded-md border bg-card"
    >
      {/* Ambient gradient */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-primary/10"
      />

      <div className="relative grid gap-6 p-6 md:grid-cols-[1.2fr_1fr] md:gap-8 md:p-8 lg:p-10">
        {/* Left column — profile */}
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div
              aria-hidden="true"
              className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"
            >
              <UserFocusIcon size={24} weight="regular" />
            </div>
            <div>
              <p className="text-xs tracking-wider text-muted-foreground uppercase">
                <Trans>Verified candidate</Trans>
              </p>
              <p className="text-base font-semibold tracking-tight">
                <Trans>Alex Morgan · Senior Software Engineer</Trans>
              </p>
            </div>
            <div
              aria-hidden="true"
              className="ms-auto hidden items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-[0.7rem] font-medium text-primary sm:flex"
            >
              <SealCheckIcon size={14} weight="fill" />
              <Trans>CV 2.0</Trans>
            </div>
          </div>

          <SectionGroup icon={CodeIcon} title={t`Technical skills`}>
            <div className="flex flex-wrap gap-1.5">
              {skills.map((skill, index) => (
                <motion.span
                  key={skill.label}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.15 + index * 0.05 }}
                  className={
                    skill.verified
                      ? "inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary"
                      : "inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground"
                  }
                >
                  {skill.verified && <SealCheckIcon size={12} weight="fill" />}
                  {skill.label}
                </motion.span>
              ))}
            </div>
          </SectionGroup>

          <SectionGroup icon={BriefcaseIcon} title={t`Experience`}>
            <div className="space-y-2">
              <div className="rounded-md border bg-background/60 p-2.5">
                <p className="text-xs font-semibold">OpenAI</p>
                <p className="text-[0.7rem] leading-snug text-muted-foreground">
                  <Trans>Lead development of LLM-powered features and AI-assisted workflows.</Trans>
                </p>
              </div>
              <div className="rounded-md border bg-background/60 p-2.5">
                <p className="text-xs font-semibold">Amazon</p>
                <p className="text-[0.7rem] leading-snug text-muted-foreground">
                  <Trans>Architected cloud-native services and led CI/CD and container platforms.</Trans>
                </p>
              </div>
            </div>
          </SectionGroup>
        </div>

        {/* Right column — badges, certifications, languages */}
        <div className="space-y-5">
          <div className="relative rounded-md border bg-background/80 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SealCheckIcon aria-hidden="true" size={18} weight="fill" className="text-primary" />
                <p className="text-sm font-semibold tracking-tight">
                  <Trans>Verdict passed</Trans>
                </p>
              </div>
              <motion.div
                aria-hidden="true"
                animate={{ rotate: [0, 14, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="text-amber-500"
              >
                <SparkleIcon size={16} weight="fill" />
              </motion.div>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              <Trans>4 skills endorsed by anonymous domain experts in the last 30 days.</Trans>
            </p>
          </div>

          <SectionGroup icon={CertificateIcon} title={t`Certifications`}>
            <div className="grid gap-1.5">
              {["React Expert", "Node.js Master", "AWS Certified"].map((cert, index) => (
                <motion.div
                  key={cert}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 + index * 0.06 }}
                  className="flex items-center gap-2 rounded-md border bg-background/60 px-2.5 py-1.5 text-xs"
                >
                  <SealCheckIcon aria-hidden="true" size={12} weight="fill" className="text-primary" />
                  <span className="font-medium">{cert}</span>
                </motion.div>
              ))}
            </div>
          </SectionGroup>

          <SectionGroup icon={GraduationCapIcon} title={t`Education`}>
            <div className="space-y-1 rounded-md border bg-background/60 p-2.5">
              <p className="text-xs font-semibold">Harvard University</p>
              <p className="text-[0.7rem] text-muted-foreground">B.Sc. Computer Science</p>
            </div>
          </SectionGroup>

          <SectionGroup icon={TranslateIcon} title={t`Languages`}>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "English", level: "C2" },
                { label: "Spanish", level: "B2" },
                { label: "French", level: "A2" },
              ].map((lang) => (
                <span
                  key={lang.label}
                  className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-[0.7rem] font-medium"
                >
                  {lang.label}
                  <span className="text-muted-foreground">{lang.level}</span>
                </span>
              ))}
            </div>
          </SectionGroup>
        </div>
      </div>

      {/* Soft bottom vignette for readability over hero gradient */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-linear-to-b from-transparent via-transparent via-40% to-background"
      />
    </div>
  );
}
