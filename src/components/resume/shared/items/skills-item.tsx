import type { SectionItem } from "@/schema/resume/data";

import { cn } from "@/utils/style";

import { PageIcon } from "../page-icon";
import { PageLevel } from "../page-level";
import { VerificationBadge } from "../verification-badge";
import { useVerificationStatus } from "../verification-context";

type SkillsItemProps = SectionItem<"skills"> & {
  className?: string;
};

export function SkillsItem({ className, ...item }: SkillsItemProps) {
  const verification = useVerificationStatus(item.id);

  return (
    <div className={cn("skills-item", className)}>
      {/* Header */}
      <div className="section-item-header flex items-center gap-x-1.5">
        <PageIcon icon={item.icon} className="section-item-icon skills-item-icon" />
        <strong className="section-item-title skills-item-name">{item.name}</strong>
        {verification && (
          <VerificationBadge
            requestId={verification.id}
            status={verification.status}
            badgeVisible={verification.badgeVisible}
            className="ml-1"
          />
        )}
      </div>

      {/* Proficiency */}
      {item.proficiency && <div className="section-item-metadata skills-item-proficiency">{item.proficiency}</div>}

      {/* Keywords */}
      {item.keywords.length > 0 && (
        <div className="section-item-keywords skills-item-keywords opacity-80">{item.keywords.join(", ")}</div>
      )}

      {/* Level */}
      <PageLevel level={item.level} className="section-item-level skills-item-level" />
    </div>
  );
}
