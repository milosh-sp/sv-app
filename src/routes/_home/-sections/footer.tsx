import type { Icon } from "@phosphor-icons/react";

import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { LinkedinLogoIcon, XLogoIcon } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useState } from "react";

import { BrandIcon } from "@/components/ui/brand-icon";
import { Button } from "@/components/ui/button";

type FooterLinkItem = {
  url: string;
  label: string;
};

type FooterLinkGroupProps = {
  title: string;
  links: FooterLinkItem[];
};

type SocialLink = {
  url: string;
  label: string;
  icon: Icon;
};

const getProductLinks = (): FooterLinkItem[] => [
  { url: "/dashboard", label: t`Dashboard` },
  { url: "#how-it-works", label: t`How it works` },
  { url: "#features", label: t`Features` },
  { url: "#frequently-asked-questions", label: t`FAQ` },
];

const getCommunityLinks = (): FooterLinkItem[] => [
  { url: "mailto:hello@skillverdict.com", label: t`Contact us` },
  { url: "/verifier", label: t`Become a verifier` },
  { url: "/candidate", label: t`Get verified` },
];

const socialLinks: SocialLink[] = [
  { url: "https://linkedin.com", label: "LinkedIn", icon: LinkedinLogoIcon },
  { url: "https://x.com", label: "X (Twitter)", icon: XLogoIcon },
];

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
            <h2 className="text-lg font-bold tracking-tight">Skill Verdict</h2>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              <Trans>
                Verified skills, honest feedback, and passive discovery — a living profile built on evidence, not
                keywords.
              </Trans>
            </p>
          </div>

          {/* Social Links */}
          <div className="flex items-center gap-2 pt-2">
            {socialLinks.map((social) => (
              <Button
                key={social.label}
                size="icon-sm"
                variant="ghost"
                nativeButton={false}
                render={
                  <a
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${social.label} (${t`opens in new tab`})`}
                  >
                    <social.icon aria-hidden="true" size={18} />
                  </a>
                }
              />
            ))}
          </div>
        </div>

        <FooterLinkGroup title={t`Product`} links={getProductLinks()} />
        <FooterLinkGroup title={t`Community`} links={getCommunityLinks()} />
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

  const isExternal = /^https?:/.test(url) || url.startsWith("mailto:");

  return (
    <li className="relative" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <a
        href={url}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noopener" : undefined}
        className="relative inline-block text-sm transition-colors hover:text-foreground"
      >
        {label}
        {isExternal && <span className="sr-only"> ({t`opens in new tab`})</span>}

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
