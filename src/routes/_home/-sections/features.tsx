import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
  CertificateIcon,
  CodeSimpleIcon,
  DotsThreeIcon,
  FileCssIcon,
  FilesIcon,
  GlobeIcon,
  HandshakeIcon,
  type Icon,
  KeyIcon,
  LayoutIcon,
  LockSimpleIcon,
  MedalIcon,
  PaletteIcon,
  ProhibitIcon,
  QrCodeIcon,
  SealCheckIcon,
  ShieldCheckIcon,
  UserCircleIcon,
  WalletIcon,
} from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useMemo } from "react";

import { cn } from "@/utils/style";

import { HOME_ACCENT } from "../-styles";

type Feature = {
  id: string;
  icon: Icon;
  title: string;
  description: string;
};

const getFeatures = (): Feature[] => [
  {
    id: "verified-skills",
    icon: SealCheckIcon,
    title: t`Peer-Verified Skills`,
    description: t`Earn verified skill badges through anonymous, scenario-based reviews by experienced Gurus.`,
  },
  {
    id: "skill-badges",
    icon: MedalIcon,
    title: t`Visual Skill Badges`,
    description: t`Showcase evidence of your abilities — every badge links to a verified assessment.`,
  },
  {
    id: "qr-sharing",
    icon: QrCodeIcon,
    title: t`Share via QR`,
    description: t`A unique QR code opens your live CV 2.0, so you can network in person or online with a single tap.`,
  },
  {
    id: "passive-discovery",
    icon: HandshakeIcon,
    title: t`Passive Discovery`,
    description: t`Stop chasing roles — let recruiters and companies find you through your verified profile.`,
  },
  {
    id: "no-ads",
    icon: ProhibitIcon,
    title: t`No Ads, No Tracking`,
    description: t`For a secure and distraction-free experience.`,
  },
  {
    id: "privacy",
    icon: ShieldCheckIcon,
    title: t`Privacy-First`,
    description: t`You control what is visible on your public CV 2.0. Only assigned verifiers can see your solutions.`,
  },
  {
    id: "auth",
    icon: KeyIcon,
    title: t`One-Click Sign-In`,
    description: t`Sign in with Google, GitHub, or a custom OAuth provider.`,
  },
  {
    id: "2fa",
    icon: ShieldCheckIcon,
    title: t`Passkeys & 2FA`,
    description: t`Enhance the security of your account with additional layers of protection.`,
  },
  {
    id: "unlimited-resumes",
    icon: FilesIcon,
    title: t`Unlimited CV 2.0s`,
    description: t`Create as many tailored CV 2.0 variants as you want, without limits.`,
  },
  {
    id: "design",
    icon: PaletteIcon,
    title: t`Flexibility`,
    description: t`Personalize your CV 2.0 with any colors, fonts, or designs, and make it your own.`,
  },
  {
    id: "css",
    icon: FileCssIcon,
    title: t`Custom CSS`,
    description: t`Write your own CSS (or use AI to generate it) to customize your CV 2.0 to the fullest.`,
  },
  {
    id: "templates",
    icon: LayoutIcon,
    title: t`12+ Templates`,
    description: t`Beautiful templates to choose from, with more on the way.`,
  },
  {
    id: "public",
    icon: GlobeIcon,
    title: t`Shareable Links`,
    description: t`Share your CV 2.0 with a public URL and let others view it.`,
  },
  {
    id: "password-protection",
    icon: LockSimpleIcon,
    title: t`Password Protection`,
    description: t`Protect your CV 2.0 with a password so only trusted viewers can open it.`,
  },
  {
    id: "wallet",
    icon: WalletIcon,
    title: t`Add to Wallet`,
    description: t`Add your CV 2.0 to your Apple or Google Wallet so your verified skills travel with you.`,
  },
  {
    id: "personality",
    icon: UserCircleIcon,
    title: t`Personality Insights`,
    description: t`Combine verified skills with personality assessments so employers understand you as a whole person.`,
  },
  {
    id: "certifications",
    icon: CertificateIcon,
    title: t`Certifications Showcase`,
    description: t`Highlight professional certifications alongside your verified skill badges.`,
  },
  {
    id: "api-access",
    icon: CodeSimpleIcon,
    title: t`API Access`,
    description: t`Access your resumes and data programmatically using the API.`,
  },
  {
    id: "more",
    icon: DotsThreeIcon,
    title: t`And many more...`,
    description: t`New features are constantly being added and improved, so be sure to check back often.`,
  },
];

type FeatureCardProps = Feature & { index: number };

function FeatureCard({ icon: Icon, title, description, index }: FeatureCardProps) {
  const prefix = String(index + 1).padStart(2, "0");

  return (
    <motion.div
      className={cn(
        "group relative flex min-h-52 flex-col gap-5 bg-background p-6 md:p-8",
        "not-last:border-b-2 not-last:border-foreground",
        "sm:not-nth-[2n]:border-r-2 sm:not-nth-[2n]:border-foreground",
        "xl:not-nth-[4n]:border-r-2 xl:not-nth-[4n]:border-foreground",
      )}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      style={{ willChange: "transform, opacity" }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-1 origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
        style={{ backgroundColor: HOME_ACCENT.lime }}
      />

      <div className="flex items-start justify-between">
        <span className="font-mono text-[0.7rem] tracking-[0.25em] text-muted-foreground uppercase">— {prefix}</span>

        <div
          aria-hidden="true"
          className="flex size-10 items-center justify-center border-2 border-foreground transition-colors duration-300 group-hover:bg-foreground group-hover:text-background"
        >
          <Icon size={18} weight="bold" />
        </div>
      </div>

      <div className="flex flex-col gap-y-2">
        <h3 className="text-xl leading-tight font-bold tracking-tight">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </motion.div>
  );
}

export function Features() {
  const features = useMemo(() => getFeatures(), []);

  return (
    <section id="features" className="border-t-2 border-foreground">
      <motion.div
        className="grid gap-6 border-b-2 border-foreground p-4 md:grid-cols-[1fr_auto] md:items-end md:gap-12 md:p-10 xl:p-14"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45 }}
        style={{ willChange: "transform, opacity" }}
      >
        <div className="space-y-4">
          <span className="font-mono text-[0.7rem] tracking-[0.3em] text-muted-foreground uppercase">
            — <Trans>Section 02 / Features</Trans>
          </span>

          <h2 className="text-4xl leading-[0.95] font-black tracking-tighter md:text-6xl xl:text-7xl">
            <Trans>
              Everything <span className="font-serif italic">you'll ever</span> need.
            </Trans>
          </h2>

          <p className="max-w-2xl leading-relaxed text-muted-foreground">
            <Trans>
              Built so opportunities come to you — privacy-first, distraction-free, and designed around verified skills,
              not keyword soup.
            </Trans>
          </p>
        </div>

        <span
          className="inline-flex self-start px-3 py-1 font-mono text-[0.7rem] tracking-[0.25em] uppercase md:self-end"
          style={{ backgroundColor: HOME_ACCENT.lime, color: HOME_ACCENT.ink }}
        >
          <Trans>{features.length}+ things you'll love</Trans>
        </span>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {features.map((feature, index) => (
          <FeatureCard key={feature.id} index={index} {...feature} />
        ))}
      </div>
    </section>
  );
}
