import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { motion } from "motion/react";
import { useState } from "react";

import { BrandIcon } from "@/components/ui/brand-icon";
import { APP_NAME, SKILL_VERDICT_LINKS } from "@/constants/brand";

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
  return (
    <motion.footer
      id="footer"
      className="p-4 pb-8 md:p-8 md:pb-12"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45 }}
      style={{ willChange: "opacity" }}
    >
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {/* Brand Column */}
        <div className="space-y-4 sm:col-span-2 lg:col-span-1">
          <BrandIcon variant="logo" className="size-10" />

          <div className="space-y-2">
            <h2 className="text-lg font-bold tracking-tight">{APP_NAME}</h2>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              <Trans>
                A dynamic CV2.0 builder with peer-verified skill badges — stop chasing jobs, and let employers come to
                you.
              </Trans>
            </p>
          </div>
        </div>

        {/* Platform Column */}
        <FooterLinkGroup title={t`Platform`} links={getPlatformLinks()} />

        {/* Company Column */}
        <FooterLinkGroup title={t`Company`} links={getCompanyLinks()} />
      </div>
    </motion.footer>
  );
}

function FooterLinkGroup({ title, links }: FooterLinkGroupProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium tracking-tight text-muted-foreground">{title}</h2>

      <ul className="space-y-3">
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
        className="relative inline-block text-sm transition-colors hover:text-foreground"
      >
        {label}
        <span className="sr-only"> ({t`opens in new tab`})</span>

        <motion.div
          aria-hidden="true"
          initial={{ width: 0, opacity: 0 }}
          animate={isHovered ? { width: "100%", opacity: 1 } : { width: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="pointer-events-none absolute inset-s-0 -bottom-0.5 h-px rounded-md bg-primary"
          style={{ willChange: "width, opacity" }}
        />
      </a>
    </li>
  );
}
