import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useRouteContext, useRouter } from "@tanstack/react-router";
import { createContext, type PropsWithChildren, use, useState } from "react";

import { getAdminRoleQueryOptionsForUser } from "@/integrations/orpc/get-admin-role-query-options";
import {
  type DashboardMode,
  getEffectiveDashboardMode,
  setDashboardModeServerFn,
  writeDashboardModeToClientCookie,
} from "@/utils/dashboard-mode";

type DashboardModeContextValue = {
  cookieMode: DashboardMode;
  effectiveMode: DashboardMode;
  isPending: boolean;
  isReviewerPrivileged: boolean;
  role: "skill_verdict_admin" | "reviewer_admin" | null;
  setMode: (mode: DashboardMode) => Promise<void>;
};

const DashboardModeContext = createContext<DashboardModeContextValue | null>(null);

type ProviderProps = PropsWithChildren<{ dashboardMode: DashboardMode }>;

export function DashboardModeProvider({ children, dashboardMode }: ProviderProps) {
  const router = useRouter();
  const navigate = useNavigate();
  const { session } = useRouteContext({ strict: false });
  const [cookieMode, setCookieMode] = useState(dashboardMode);
  const [prevDashboardMode, setPrevDashboardMode] = useState(dashboardMode);

  if (dashboardMode !== prevDashboardMode) {
    setPrevDashboardMode(dashboardMode);
    setCookieMode(dashboardMode);
  }

  const { data: adminRole } = useQuery({
    ...getAdminRoleQueryOptionsForUser(session?.user?.id ?? ""),
    enabled: Boolean(session?.user?.id),
    staleTime: 5 * 60 * 1000,
  });

  const role = adminRole?.role ?? null;
  const isReviewerPrivileged = role === "reviewer_admin";
  const effectiveMode = getEffectiveDashboardMode(role, cookieMode);

  const { mutateAsync: setModeMutation, isPending } = useMutation({
    mutationFn: async (mode: DashboardMode) => {
      setCookieMode(mode);
      writeDashboardModeToClientCookie(mode);
      await setDashboardModeServerFn({ data: mode });
    },
    onSuccess: async (_data, mode) => {
      await router.invalidate();
      await navigate({
        to: mode === "reviewer" ? "/dashboard/reviewer/queue" : "/dashboard/resumes",
        replace: true,
      });
    },
    onError: () => {
      setCookieMode(dashboardMode);
      writeDashboardModeToClientCookie(dashboardMode);
    },
  });

  async function setMode(mode: DashboardMode) {
    await setModeMutation(mode);
  }

  return (
    <DashboardModeContext
      value={{
        cookieMode,
        effectiveMode,
        isPending,
        isReviewerPrivileged,
        role,
        setMode,
      }}
    >
      {children}
    </DashboardModeContext>
  );
}

export function useDashboardMode() {
  const value = use(DashboardModeContext);

  if (!value) {
    throw new Error("useDashboardMode must be used within a DashboardModeProvider");
  }

  return value;
}
