import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
  CaretDownIcon,
  CopySimpleIcon,
  HouseSimpleIcon,
  LockSimpleIcon,
  LockSimpleOpenIcon,
  PencilSimpleLineIcon,
  SidebarSimpleIcon,
  TrashSimpleIcon,
} from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { useResumeStore } from "@/components/resume/store/resume";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDialogStore } from "@/dialogs/store";
import { useConfirm } from "@/hooks/use-confirm";
import { orpc } from "@/integrations/orpc/client";

import { useBuilderSidebar } from "../-store/sidebar";

export function BuilderHeader() {
  const name = useResumeStore((state) => state.resume.name);
  const isLocked = useResumeStore((state) => state.resume.isLocked);
  const toggleSidebar = useBuilderSidebar((state) => state.toggleSidebar);

  return (
    <div className="absolute inset-x-0 top-0 z-10 flex h-14 items-center justify-between border-b bg-popover px-2">
      <Button
        size="icon"
        variant="ghost"
        className="size-10 md:size-9"
        aria-label={t`Open content editor`}
        title={t`Open content editor`}
        onClick={() => toggleSidebar("left")}
      >
        <SidebarSimpleIcon />
      </Button>

      <div className="flex min-w-0 flex-1 items-center justify-center gap-x-1 px-2 sm:justify-start">
        <Button
          size="icon"
          variant="ghost"
          className="xs:inline-flex hidden md:size-9"
          aria-label={t`Back to resumes`}
          title={t`Back to resumes`}
          nativeButton={false}
          render={
            <Link to="/dashboard/resumes" search={{ sort: "lastUpdatedAt", tags: [] }}>
              <HouseSimpleIcon />
            </Link>
          }
        />
        <span className="xs:inline me-2.5 hidden text-muted-foreground">/</span>
        <h2 className="min-w-0 truncate text-sm font-medium sm:text-base">{name}</h2>
        {isLocked && <LockSimpleIcon className="ms-2 text-muted-foreground" />}
        <BuilderHeaderDropdown />
      </div>

      <Button
        size="icon"
        variant="ghost"
        className="size-10 md:size-9"
        aria-label={t`Open design settings`}
        title={t`Open design settings`}
        onClick={() => toggleSidebar("right")}
      >
        <SidebarSimpleIcon className="-scale-x-100" />
      </Button>
    </div>
  );
}

function BuilderHeaderDropdown() {
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { openDialog } = useDialogStore();

  const id = useResumeStore((state) => state.resume.id);
  const name = useResumeStore((state) => state.resume.name);
  const slug = useResumeStore((state) => state.resume.slug);
  const tags = useResumeStore((state) => state.resume.tags);
  const isLocked = useResumeStore((state) => state.resume.isLocked);

  const { mutate: deleteResume } = useMutation(orpc.resume.delete.mutationOptions());
  const { mutate: setLockedResume } = useMutation(orpc.resume.setLocked.mutationOptions());

  const handleUpdate = () => {
    openDialog("resume.update", { id, name, slug, tags });
  };

  const handleDuplicate = () => {
    openDialog("resume.duplicate", { id, name, slug, tags, shouldRedirect: true });
  };

  const handleToggleLock = async () => {
    if (!isLocked) {
      const confirmation = await confirm(t`Are you sure you want to lock this resume?`, {
        description: t`When locked, the resume cannot be updated or deleted.`,
      });

      if (!confirmation) return;
    }

    setLockedResume(
      { id, isLocked: !isLocked },
      {
        onError: (error) => {
          toast.error(error.message);
        },
      },
    );
  };

  const handleDelete = async () => {
    const confirmation = await confirm(t`Are you sure you want to delete this resume?`, {
      description: t`This action cannot be undone.`,
    });

    if (!confirmation) return;

    const toastId = toast.loading(t`Deleting your resume...`);

    deleteResume(
      { id },
      {
        onSuccess: () => {
          toast.success(t`Your resume has been deleted successfully.`, { id: toastId });
          void navigate({ to: "/dashboard/resumes", search: { sort: "lastUpdatedAt", tags: [] } });
        },
        onError: (error) => {
          toast.error(error.message, { id: toastId });
        },
      },
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button size="icon" variant="ghost">
            <CaretDownIcon />
          </Button>
        }
      />

      <DropdownMenuContent>
        <DropdownMenuItem disabled={isLocked} onClick={handleUpdate}>
          <PencilSimpleLineIcon className="me-2" />
          <Trans>Update</Trans>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleDuplicate}>
          <CopySimpleIcon className="me-2" />
          <Trans>Duplicate</Trans>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleToggleLock}>
          {isLocked ? <LockSimpleOpenIcon className="me-2" /> : <LockSimpleIcon className="me-2" />}
          {isLocked ? <Trans>Unlock</Trans> : <Trans>Lock</Trans>}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem variant="destructive" disabled={isLocked} onClick={handleDelete}>
          <TrashSimpleIcon className="me-2" />
          <Trans>Delete</Trans>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
