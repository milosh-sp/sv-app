import { VerificationBadge } from "./verification-badge";
import { useIdentityVerificationStatus } from "./verification-context";

type HeaderNameWithVerificationProps = {
  name: string;
  className?: string;
};

export function HeaderNameWithVerification({ name, className }: HeaderNameWithVerificationProps) {
  const identityVerification = useIdentityVerificationStatus();
  const shouldShowBadge = identityVerification?.status === "verified";

  return (
    <h2 className={className}>
      {name}
      {shouldShowBadge && (
        <VerificationBadge
          requestId={identityVerification.id}
          status={identityVerification.status}
          badgeVisible={identityVerification.badgeVisible}
          className="ms-1 align-middle"
        />
      )}
    </h2>
  );
}
