import {
  PRIVACY_POLICY_CONTINUE_NOTICE,
  PRIVACY_POLICY_FORM_NOTICE,
  PRIVACY_POLICY_LINK_LABEL,
  PRIVACY_POLICY_URL,
} from "@/utils/privacy-policy";
import { cn } from "@/utils/style";

type PrivacyPolicyNoticeProps = {
  className?: string;
  variant?: "form" | "continue";
};

export function PrivacyPolicyNotice({ className, variant = "form" }: PrivacyPolicyNoticeProps) {
  const notice = variant === "continue" ? PRIVACY_POLICY_CONTINUE_NOTICE : PRIVACY_POLICY_FORM_NOTICE;

  return (
    <p className={cn("text-center text-sm text-muted-foreground", className)}>
      {notice}{" "}
      <a
        className="font-medium text-primary underline-offset-4 hover:underline"
        href={PRIVACY_POLICY_URL}
        rel="noreferrer"
        target="_blank"
      >
        {PRIVACY_POLICY_LINK_LABEL}
      </a>
    </p>
  );
}
