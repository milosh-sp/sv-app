import { createContext, useContext } from "react";

export type VerificationStatus = {
  id: string;
  sectionType: string;
  itemId: string;
  itemLabel: string;
  status: string;
  badgeVisible: boolean;
};

type VerificationContextValue = {
  statuses: VerificationStatus[];
};

const VerificationContext = createContext<VerificationContextValue>({
  statuses: [],
});

export function VerificationProvider({
  statuses,
  children,
}: {
  statuses: VerificationStatus[];
  children: React.ReactNode;
}) {
  return <VerificationContext value={{ statuses }}>{children}</VerificationContext>;
}

export function findVerificationStatus(statuses: VerificationStatus[], itemId: string): VerificationStatus | undefined {
  return statuses.find((status) => status.itemId === itemId);
}

export function useVerificationStatus(itemId: string): VerificationStatus | undefined {
  const { statuses } = useContext(VerificationContext);
  return findVerificationStatus(statuses, itemId);
}

export function useIdentityVerificationStatus(): VerificationStatus | undefined {
  const { statuses } = useContext(VerificationContext);
  return statuses.find((s) => s.sectionType === "identity");
}
