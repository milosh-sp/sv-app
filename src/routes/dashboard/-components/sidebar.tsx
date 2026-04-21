import type { MessageDescriptor } from "@lingui/core";

import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import {
  ArrowLeftIcon,
  BrainIcon,
  BriefcaseIcon,
  DotsThreeIcon,
  EyeIcon,
  GearSixIcon,
  IdentificationCardIcon,
  KeyIcon,
  ReadCvLogoIcon,
  SealCheckIcon,
  ShieldCheckIcon,
  ShieldStarIcon,
  UserCircleIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouteContext } from "@tanstack/react-router";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BrandIcon } from "@/components/ui/brand-icon";
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

const privacySettingsSidebarItem = {
  icon: <EyeIcon />,
  label: msg`Privacy`,
  href: "/dashboard/settings/privacy",
  exact: false,
} as const satisfies SidebarItem;

const settingsSidebarItems = [...settingsSidebarBaseItems, privacySettingsSidebarItem] as const satisfies SidebarItem[];

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
  const adminRoleQueryOptions = orpc.auth.getAdminRole.queryOptions();
  const { data: adminRole } = useQuery({
    ...adminRoleQueryOptions,
    queryKey: [...adminRoleQueryOptions.queryKey, session?.user?.id ?? "anonymous"],
    enabled: Boolean(session?.user),
    staleTime: 5 * 60 * 1000,
  });

  const isSkillVerdictAdmin = adminRole?.role === "skill_verdict_admin";
  const backLink = isSkillVerdictAdmin
    ? { to: "/dashboard/admin/experience-queue" as const, label: msg`Back to review queue` }
    : { to: "/dashboard/resumes" as const, label: msg`Back to dashboard` };
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
          "--sidebar-width": "14rem",
          "--sidebar-width-icon": "3.5rem",
        } as React.CSSProperties
      }
      className="border-none md:absolute! md:inset-y-4 md:data-[side=left]:left-4 md:data-[side=right]:right-4 group-data-[side=left]:border-none group-data-[side=right]:border-none"
    >
      <SidebarHeader className="gap-3 p-3">
        <div className="flex items-center gap-3 px-1">
          <Link
            to="/"
            className="rounded-md p-1 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <BrandIcon variant="logo" className="h-5 w-auto" />
            <h1 className="sr-only">Skill Verdict</h1>
          </Link>

          <Link
            to={backLink.to}
            className="inline-flex items-center gap-1.5 text-sm text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground"
          >
            <ArrowLeftIcon className="size-3.5" />
            <span className="shrink-0 transition-[margin,opacity] duration-200 ease-in-out group-data-[collapsible=icon]:-ms-8 group-data-[collapsible=icon]:opacity-0">
              {i18n.t(backLink.label)}
            </span>
          </Link>
        </div>

        <SidebarMenu>
          <SidebarMenuItem>
            <UserDropdownMenu>
              {({ session }) => (
                <SidebarMenuButton className="mx-1 h-auto gap-x-3 rounded-lg py-2 group-data-[collapsible=icon]:mx-0 group-data-[collapsible=icon]:p-1!">
                  <Avatar className="size-8 shrink-0 transition-all group-data-[collapsible=icon]:size-6">
                    <AvatarImage src={session.user.image ?? undefined} />
                    <AvatarFallback className="group-data-[collapsible=icon]:text-[0.5rem]">
                      {getInitials(session.user.name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1 transition-[margin,opacity] duration-200 ease-in-out group-data-[collapsible=icon]:-ms-8 group-data-[collapsible=icon]:opacity-0">
                    <p className="truncate font-medium">{session.user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {roleLabel ? i18n.t(roleLabel) : session.user.email}
                    </p>
                  </div>

                  <DotsThreeIcon className="size-4 shrink-0 text-sidebar-foreground/60 transition-opacity group-data-[collapsible=icon]:opacity-0" />
                </SidebarMenuButton>
              )}
            </UserDropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {!isSkillVerdictAdmin && (
          <SidebarGroup className="pt-1">
            <SidebarGroupLabel>
              <Trans>App</Trans>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarItemList items={appSidebarItems} />
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {!isSkillVerdictAdmin && <SidebarSeparator className="mx-3" />}

        <SidebarGroup className="pt-1">
          <SidebarGroupLabel>
            <Trans>Settings</Trans>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarItemList items={isSkillVerdictAdmin ? settingsSidebarBaseItems : settingsSidebarItems} />
          </SidebarGroupContent>
        </SidebarGroup>

        {isSkillVerdictAdmin && (
          <>
            <SidebarSeparator className="mx-3" />

            <SidebarGroup className="pt-1">
              <SidebarGroupLabel>
                <Trans>Skill Verdict Verification</Trans>
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarItemList items={skillVerdictVerificationSidebarItems} />
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator className="mx-3" />

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
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
