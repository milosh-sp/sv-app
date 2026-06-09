import type { MessageDescriptor } from "@lingui/core";

import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import {
  BrainIcon,
  BriefcaseIcon,
  DotsThreeIcon,
  EyeIcon,
  GearSixIcon,
  GlobeIcon,
  IdentificationCardIcon,
  KeyIcon,
  ReadCvLogoIcon,
  SealCheckIcon,
  ShieldCheckIcon,
  ShieldStarIcon,
  UserCircleIcon,
  UserListIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouteContext } from "@tanstack/react-router";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { UserDropdownMenu } from "@/components/user/dropdown-menu";
import { orpc } from "@/integrations/orpc/client";
import { getAdminRoleQueryOptionsForUser } from "@/integrations/orpc/get-admin-role-query-options";
import {
  deriveIdentitySidebarVerificationState,
  SidebarIdentityVerificationStatus,
} from "@/routes/dashboard/-components/sidebar-identity-verification-status";
import { getInitials } from "@/utils/string";

type SidebarItem = {
  icon: React.ReactNode;
  label: MessageDescriptor;
  href: React.ComponentProps<typeof Link>["to"];
  exact?: boolean;
};

const appSidebarItems = [
  {
    icon: <ReadCvLogoIcon />,
    label: msg`Resumes`,
    href: "/dashboard/resumes",
  },
  {
    icon: <BriefcaseIcon />,
    label: msg`Job Search`,
    href: "/dashboard/job-search",
  },
  {
    icon: <SealCheckIcon />,
    label: msg`Verification`,
    href: "/dashboard/verification",
  },
  {
    icon: <EyeIcon />,
    label: msg`Privacy`,
    href: "/dashboard/settings/privacy",
    exact: false,
  },
  {
    icon: <GlobeIcon />,
    label: msg`Work Authorization`,
    href: "/dashboard/work-authorization",
  },
] as const satisfies SidebarItem[];

const settingsSidebarBaseItems = [
  {
    icon: <UserCircleIcon />,
    label: msg`Profile`,
    href: "/dashboard/settings/profile",
    exact: false,
  },
  {
    icon: <GearSixIcon />,
    label: msg`Preferences`,
    href: "/dashboard/settings/preferences",
    exact: false,
  },
  {
    icon: <ShieldCheckIcon />,
    label: msg`Authentication`,
    href: "/dashboard/settings/authentication",
    exact: false,
  },

  {
    icon: <WarningIcon />,
    label: msg`Danger Zone`,
    href: "/dashboard/settings/danger-zone",
    exact: false,
  },
] as const satisfies SidebarItem[];

const settingsSidebarItems = [...settingsSidebarBaseItems] as const satisfies SidebarItem[];

const reviewerSidebarItems = [
  {
    icon: <SealCheckIcon />,
    label: msg`Skill Review Queue`,
    href: "/dashboard/reviewer/queue",
  },
] as const satisfies SidebarItem[];

const skillVerdictVerificationSidebarItems = [
  {
    icon: <ShieldStarIcon />,
    label: msg`Experience Queue`,
    href: "/dashboard/admin/experience-queue",
  },
  {
    icon: <IdentificationCardIcon />,
    label: msg`Identity Queue`,
    href: "/dashboard/admin/identity",
  },
] as const satisfies SidebarItem[];

const adminSidebarItems = [
  {
    icon: <UserListIcon />,
    label: msg`Users`,
    href: "/dashboard/admin/users",
  },
  {
    icon: <SealCheckIcon />,
    label: msg`Reviewers`,
    href: "/dashboard/admin/reviewers",
  },
  {
    icon: <BrainIcon />,
    label: msg`Global AI`,
    href: "/dashboard/admin/ai",
  },
  {
    icon: <KeyIcon />,
    label: msg`API Keys`,
    href: "/dashboard/settings/api-keys",
    exact: false,
  },
  {
    icon: <BriefcaseIcon />,
    label: msg`Job Search API`,
    href: "/dashboard/admin/job-search",
  },
] as const satisfies SidebarItem[];

type SidebarItemListProps = {
  items: readonly SidebarItem[];
};

function SidebarItemList({ items }: SidebarItemListProps) {
  const { i18n } = useLingui();

  return (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton
            className="mx-1 rounded-lg group-data-[collapsible=icon]:mx-0"
            title={i18n.t(item.label)}
            render={
              <Link
                to={item.href}
                activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
                activeOptions={{ exact: item.exact ?? true }}
              >
                {item.icon}
                <span className="shrink-0 transition-[margin,opacity] duration-200 ease-in-out group-data-[collapsible=icon]:-ms-8 group-data-[collapsible=icon]:opacity-0">
                  {i18n.t(item.label)}
                </span>
              </Link>
            }
          />
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

export function DashboardSidebar() {
  const { i18n } = useLingui();
  const { session } = useRouteContext({ strict: false });
  const staleTime = 5 * 60 * 1000;

  const { data: adminRole } = useQuery({
    ...getAdminRoleQueryOptionsForUser(session?.user?.id ?? ""),
    enabled: Boolean(session?.user?.id),
    staleTime,
  });
  const { data: user } = useQuery({
    ...orpc.verification.getIdentityStatus.queryOptions(),
    enabled: Boolean(session?.user),
    staleTime,
  });

  const identityVerificationState = deriveIdentitySidebarVerificationState(user);
  const isSkillVerdictAdmin = adminRole?.role === "skill_verdict_admin";
  const isReviewerAdmin = adminRole?.role === "reviewer_admin";
  const roleLabel = (() => {
    if (adminRole?.role === "skill_verdict_admin") return msg`Skill Verdict Admin`;
    if (adminRole?.role === "reviewer_admin") return msg`Reviewer Admin`;
    return null;
  })();

  return (
    <Sidebar
      variant="sidebar"
      collapsible="icon"
      style={
        {
          "--sidebar-width": "16rem",
          "--sidebar-width-icon": "3.5rem",
          ...(isSkillVerdictAdmin ? { "--sidebar-primary": "#2b6a9a" } : {}),
        } as React.CSSProperties
      }
      className="border-none group-data-[side=left]:border-none group-data-[side=right]:border-none md:absolute! md:inset-y-4 md:data-[side=left]:left-4 md:data-[side=right]:right-4"
    >
      <SidebarHeader className="gap-3 px-2.5 py-3 sm:px-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <UserDropdownMenu>
              {({ session }) => (
                <SidebarMenuButton className="mx-0 h-auto gap-x-2.5 rounded-lg py-2 group-data-[collapsible=icon]:p-1! sm:gap-x-3">
                  <Avatar className="size-8 shrink-0 transition-all group-data-[collapsible=icon]:size-6">
                    <AvatarImage src={session.user.image ?? undefined} />
                    <AvatarFallback className="group-data-[collapsible=icon]:text-[0.5rem]">
                      {getInitials(session.user.name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1 transition-[margin,opacity] duration-200 ease-in-out group-data-[collapsible=icon]:-ms-8 group-data-[collapsible=icon]:opacity-0">
                    <p className="truncate font-medium">{session.user.name}</p>

                    <p
                      className={
                        adminRole?.role === "skill_verdict_admin"
                          ? "truncate text-xs text-sidebar-primary"
                          : "truncate text-xs text-muted-foreground"
                      }
                    >
                      {roleLabel ? i18n.t(roleLabel) : session.user.email}
                    </p>
                    {!adminRole?.role && <SidebarIdentityVerificationStatus state={identityVerificationState} />}
                  </div>

                  <DotsThreeIcon className="size-4 shrink-0 text-sidebar-foreground/60 transition-opacity group-data-[collapsible=icon]:opacity-0" />
                </SidebarMenuButton>
              )}
            </UserDropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator className="mx-3" />

      <SidebarContent className="gap-0">
        {!isSkillVerdictAdmin && (
          <SidebarGroup className="pt-1">
            <SidebarGroupLabel>
              <Trans>Skill Center</Trans>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarItemList items={appSidebarItems} />
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isReviewerAdmin && (
          <>
            <SidebarGroup className="pt-1">
              <SidebarGroupLabel>
                <Trans>Reviewer</Trans>
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarItemList items={reviewerSidebarItems} />
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarSeparator className="mx-3" />
          </>
        )}

        {!isSkillVerdictAdmin && <SidebarSeparator className="mx-3" />}
        {isSkillVerdictAdmin && (
          <>
            <SidebarGroup className="pt-1">
              <SidebarGroupLabel>
                <Trans>Skill Verdict Verification</Trans>
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarItemList items={skillVerdictVerificationSidebarItems} />
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="pt-1">
              <SidebarGroupLabel>
                <Trans>Administration</Trans>
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarItemList items={adminSidebarItems} />
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        <SidebarGroup className="pt-1">
          <SidebarGroupLabel>
            <Trans>Settings</Trans>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarItemList items={isSkillVerdictAdmin ? settingsSidebarBaseItems : settingsSidebarItems} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
