import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { motion } from "motion/react";
import { useState } from "react";

import { BrandIcon } from "@/components/ui/brand-icon";
import { APP_NAME, SKILL_VERDICT_LINKS } from "@/constants/brand";

import { HOME_ACCENT } from "../-styles";

type FooterLinkItem = {
  url: string;
  label: string;
};

type FooterLinkGroupProps = {
  title: string;
  links: FooterLinkItem[];
};

const getPlatformLinks = (): FooterLinkItem[] => [
  { url: SKILL_VERDICT_LINKS.home, label: t`Skill Verdict` },
  { url: SKILL_VERDICT_LINKS.candidate, label: t`Verify my skills` },
  { url: SKILL_VERDICT_LINKS.verifier, label: t`Earn by verifying` },
];

const getCompanyLinks = (): FooterLinkItem[] => [{ url: SKILL_VERDICT_LINKS.contact, label: t`Contact` }];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <motion.footer
      id="footer"
      className="border-t-2 border-foreground"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45 }}
      style={{ willChange: "opacity" }}
    >
      <div className="grid grid-cols-1 gap-10 p-6 md:grid-cols-[1.4fr_1fr_1fr] md:p-10 xl:p-14">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <span
              className="flex size-10 items-center justify-center border-2 border-foreground"
              style={{ backgroundColor: HOME_ACCENT.lime }}
            >
              <BrandIcon variant="logo" forceTheme="light" className="size-6" />
            </span>
            <span className="font-mono text-sm tracking-[0.2em] uppercase">{APP_NAME}</span>
          </div>

          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            <Trans>
              A dynamic CV 2.0 builder with peer-verified skill badges — stop chasing jobs and let employers come to
              you.
            </Trans>
          </p>
        </div>

        <FooterLinkGroup title={t`Platform`} links={getPlatformLinks()} />
        <FooterLinkGroup title={t`Company`} links={getCompanyLinks()} />
      </div>

      <div className="overflow-hidden border-t-2 border-foreground">
        <div
          aria-hidden="true"
          className="pointer-events-none select-none"
          style={{
            fontWeight: 900,
            letterSpacing: "-0.05em",
            lineHeight: 0.85,
            WebkitTextStroke: "1.5px currentColor",
            color: "transparent",
          }}
        >
          <div className="flex items-baseline justify-between gap-4 px-4 py-6 text-[18vw] whitespace-nowrap md:px-10 md:py-10">
            <span>{APP_NAME.toUpperCase()}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-start justify-between gap-4 border-t-2 border-foreground px-6 py-4 font-mono text-[0.7rem] tracking-[0.2em] uppercase md:flex-row md:items-center md:px-10">
        <span className="text-muted-foreground">
          © {year} {APP_NAME}
        </span>
        <span className="flex items-center gap-2 text-muted-foreground">
          <span className="size-1.5 rounded-full" style={{ backgroundColor: HOME_ACCENT.lime }} />
          <Trans>Made for people, not keywords</Trans>
        </span>
      </div>
    </motion.footer>
  );
}

function FooterLinkGroup({ title, links }: FooterLinkGroupProps) {
  return (
    <div className="space-y-4">
      <h2 className="font-mono text-[0.7rem] tracking-[0.25em] text-muted-foreground uppercase">— {title}</h2>

      <ul className="space-y-2.5">
        {links.map((link) => (
          <FooterLink key={link.url} url={link.url} label={link.label} />
        ))}
      </ul>
    </div>
  );
}

function FooterLink({ url, label }: FooterLinkItem) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <li className="relative" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <a
        href={url}
        target="_blank"
        rel="noopener"
        className="relative inline-flex items-center gap-2 text-base font-bold tracking-tight transition-colors hover:text-foreground md:text-lg"
      >
        <span aria-hidden="true" className="font-mono text-[0.65rem] text-muted-foreground">
          ↗
        </span>
        {label}
        <span className="sr-only"> ({t`opens in new tab`})</span>

        <motion.div
          aria-hidden="true"
          initial={{ width: 0, opacity: 0 }}
          animate={isHovered ? { width: "100%", opacity: 1 } : { width: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="pointer-events-none absolute inset-s-0 -bottom-0.5 h-0.5"
          style={{ backgroundColor: HOME_ACCENT.lime, willChange: "width, opacity" }}
        />
      </a>
    </li>
  );
}
