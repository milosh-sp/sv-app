import type z from "zod";

import { Trans } from "@lingui/react/macro";
import { IconContext, type IconProps } from "@phosphor-icons/react";
import { useMemo } from "react";
import { match } from "ts-pattern";

import type { pageLayoutSchema } from "@/schema/resume/data";
import type { Template } from "@/schema/templates";

import { sanitizeCss } from "@/utils/sanitize";
import { cn } from "@/utils/style";

import { useCSSVariables } from "./hooks/use-css-variables";
import { useWebfonts } from "./hooks/use-webfonts";
import styles from "./preview.module.css";
import { useResumeStore } from "./store/resume";
import { AzurillTemplate } from "./templates/azurill";
import { BronzorTemplate } from "./templates/bronzor";
import { ChikoritaTemplate } from "./templates/chikorita";
import { DitgarTemplate } from "./templates/ditgar";
import { DittoTemplate } from "./templates/ditto";
import { GengarTemplate } from "./templates/gengar";
import { GlalieTemplate } from "./templates/glalie";
import { KakunaTemplate } from "./templates/kakuna";
import { LaprasTemplate } from "./templates/lapras";
import { LeafishTemplate } from "./templates/leafish";
import { OnyxTemplate } from "./templates/onyx";
import { PikachuTemplate } from "./templates/pikachu";
import { RhyhornTemplate } from "./templates/rhyhorn";

export type ExtendedIconProps = IconProps & {
  hidden?: boolean;
};

const CSS_RULE_SPLIT_PATTERN = /\n(?=\s*[.#a-zA-Z])/;
const CSS_SELECTOR_PATTERN = /^([^{]+)(\{)/;

function getTemplateComponent(template: Template) {
  return match(template)
    .with("azurill", () => AzurillTemplate)
    .with("bronzor", () => BronzorTemplate)
    .with("chikorita", () => ChikoritaTemplate)
    .with("ditto", () => DittoTemplate)
    .with("ditgar", () => DitgarTemplate)
    .with("gengar", () => GengarTemplate)
    .with("glalie", () => GlalieTemplate)
    .with("kakuna", () => KakunaTemplate)
    .with("lapras", () => LaprasTemplate)
    .with("leafish", () => LeafishTemplate)
    .with("onyx", () => OnyxTemplate)
    .with("pikachu", () => PikachuTemplate)
    .with("rhyhorn", () => RhyhornTemplate)
    .exhaustive();
}

type Props = React.ComponentProps<"div"> & {
  pageClassName?: string;
  showPageNumbers?: boolean;
};

export const ResumePreview = ({ showPageNumbers = false, pageClassName, className, ...props }: Props) => {
  const picture = useResumeStore((state) => state.resume.data.picture);
  const metadata = useResumeStore((state) => state.resume.data.metadata);

  useWebfonts(metadata.typography);
  const style = useCSSVariables({ picture, metadata });

  const iconProps = useMemo<ExtendedIconProps>(() => {
    return {
      weight: "regular",
      hidden: metadata.page.hideIcons,
      color: "var(--page-primary-color)",
      size: metadata.typography.body.fontSize * 1.5,
    } satisfies ExtendedIconProps;
  }, [metadata.typography.body.fontSize, metadata.page.hideIcons]);

  const scopedCSS = useMemo(() => {
    if (!metadata.css.enabled || !metadata.css.value.trim()) return null;

    const sanitizedCss = sanitizeCss(metadata.css.value);

    const scoped = sanitizedCss
      .split(CSS_RULE_SPLIT_PATTERN)
      .map((rule) => {
        const trimmed = rule.trim();
        if (!trimmed || trimmed.startsWith("@")) return trimmed;

        return trimmed.replace(CSS_SELECTOR_PATTERN, (_match, selectors, brace) => {
          const prefixed = selectors
            .split(",")
            .map((selector: string) => `.resume-preview-container ${selector.trim()} `)
            .join(", ");
          return `${prefixed}${brace}`;
        });
      })
      .join("\n");

    return scoped;
  }, [metadata.css.enabled, metadata.css.value]);

  return (
    <IconContext.Provider value={iconProps}>
      {scopedCSS && <style dangerouslySetInnerHTML={{ __html: scopedCSS }} />}

      <div style={style} className={cn("resume-preview-container", className)} {...props}>
        {metadata.layout.pages.map((pageLayout, pageIndex) => (
          <PageContainer
            key={pageIndex}
            pageIndex={pageIndex}
            pageLayout={pageLayout}
            pageClassName={pageClassName}
            showPageNumbers={showPageNumbers}
          />
        ))}
      </div>
    </IconContext.Provider>
  );
};

type PageContainerProps = {
  pageIndex: number;
  pageLayout: z.infer<typeof pageLayoutSchema>;
  pageClassName?: string;
  showPageNumbers?: boolean;
};

function PageContainer({ pageIndex, pageLayout, pageClassName, showPageNumbers = false }: PageContainerProps) {
  const metadata = useResumeStore((state) => state.resume.data.metadata);

  const pageNumber = useMemo(() => pageIndex + 1, [pageIndex]);
  const totalNumberOfPages = useMemo(() => metadata.layout.pages.length, [metadata.layout.pages]);
  const TemplateComponent = useMemo(() => getTemplateComponent(metadata.template), [metadata.template]);

  return (
    <div data-page-index={pageIndex} className="relative">
      {showPageNumbers && totalNumberOfPages > 1 && (
        <div className="absolute inset-s-0 -top-6 print:hidden">
          <span className="text-xs font-medium text-foreground">
            <Trans>
              Page {pageNumber} of {totalNumberOfPages}
            </Trans>
          </span>
        </div>
      )}

      <div className={cn(`page page-${pageIndex}`, styles.page, pageClassName)}>
        <TemplateComponent pageIndex={pageIndex} pageLayout={pageLayout} />
      </div>
    </div>
  );
}
