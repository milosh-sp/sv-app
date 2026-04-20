import type { MessageDescriptor } from "@lingui/core";

import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import {
  BrainIcon,
  BriefcaseIcon,
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
  SidebarFooter,
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
  },
  {
    icon: <GearSixIcon />,
    label: msg`Preferences`,
    href: "/dashboard/settings/preferences",
  },
  {
    icon: <ShieldCheckIcon />,
    label: msg`Authentication`,
    href: "/dashboard/settings/authentication",
  },

  {
    icon: <WarningIcon />,
    label: msg`Danger Zone`,
    href: "/dashboard/settings/danger-zone",
  },
] as const satisfies SidebarItem[];

const privacySettingsSidebarItem = {
  icon: <EyeIcon />,
  label: msg`Privacy`,
  href: "/dashboard/settings/privacy",
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
            title={i18n.t(item.label)}
            render={
              <Link to={item.href} activeProps={{ className: "bg-sidebar-accent" }} activeOptions={{ exact: true }}>
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
  const roleLabel = (() => {
    if (adminRole?.role === "skill_verdict_admin") return msg`Skill Verdict Admin`;
    if (adminRole?.role === "reviewer_admin") return msg`Reviewer Admin`;
    return null;
  })();

  return (
    <Sidebar variant="floating" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-auto justify-center"
              render={
                <Link to="/">
                  <BrandIcon variant="icon" className="size-6" />
                  <h1 className="sr-only">Reactive Resume</h1>
                </Link>
              }
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        {!isSkillVerdictAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>
              <Trans>App</Trans>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarItemList items={appSidebarItems} />
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>
            <Trans>Settings</Trans>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarItemList items={isSkillVerdictAdmin ? settingsSidebarBaseItems : settingsSidebarItems} />
          </SidebarGroupContent>
        </SidebarGroup>

        {isSkillVerdictAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>
              <Trans>Skill Verdict Verification</Trans>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarItemList items={skillVerdictVerificationSidebarItems} />
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isSkillVerdictAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>
              <Trans>Administration</Trans>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarItemList items={adminSidebarItems} />
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="gap-y-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <UserDropdownMenu>
              {({ session }) => (
                <SidebarMenuButton className="h-auto gap-x-3 group-data-[collapsible=icon]:p-1!">
                  <Avatar className="size-8 shrink-0 transition-all group-data-[collapsible=icon]:size-6">
                    <AvatarImage src={session.user.image ?? undefined} />
                    <AvatarFallback className="group-data-[collapsible=icon]:text-[0.5rem]">
                      {getInitials(session.user.name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="transition-[margin,opacity] duration-200 ease-in-out group-data-[collapsible=icon]:-ms-8 group-data-[collapsible=icon]:opacity-0">
                    <p className="font-medium">{session.user.name}</p>
                    <p className="text-xs text-muted-foreground">{session.user.email}</p>
                    {roleLabel && <p className="text-xs text-muted-foreground">{i18n.t(roleLabel)}</p>}
                  </div>
                </SidebarMenuButton>
              )}
            </UserDropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
