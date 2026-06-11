import { zodResolver } from "@hookform/resolvers/zod";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
  CalendarCheckIcon,
  CheckIcon,
  ClockIcon,
  SealCheckIcon,
  UserCircleIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { match } from "ts-pattern";
import z from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/integrations/auth/client";
import { orpc } from "@/integrations/orpc/client";
import { getAdminRoleQueryOptionsForUser } from "@/integrations/orpc/get-admin-role-query-options";

import { DashboardHeader } from "../-components/header";

export const Route = createFileRoute("/dashboard/settings/profile")({
  component: RouteComponent,
});

const formSchema = z.object({
  name: z.string().trim().min(1).max(64),
  username: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9._-]+$/, {
      message: "Username can only contain lowercase letters, numbers, dots, hyphens and underscores.",
    }),
  email: z.email().trim(),
});

type FormValues = z.infer<typeof formSchema>;

function RouteComponent() {
  const router = useRouter();
  const { session } = Route.useRouteContext();
  const { data } = useSuspenseQuery(getAdminRoleQueryOptionsForUser(session.user.id));

  const defaultValues = useMemo(() => {
    return {
      name: session.user.name,
      username: session.user.username,
      email: session.user.email,
    };
  }, [session.user]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const onCancel = () => {
    form.reset(defaultValues);
  };

  const onSubmit = async (data: FormValues) => {
    const { error } = await authClient.updateUser({
      name: data.name,
      username: data.username,
      displayUsername: data.username,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(t`Your profile has been updated successfully.`);
    form.reset({ name: data.name, username: data.username, email: session.user.email });
    void router.invalidate();

    if (data.email !== session.user.email) {
      const { error } = await authClient.changeEmail({
        newEmail: data.email,
        callbackURL: "/dashboard/settings/profile",
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success(
        t`A confirmation link has been sent to your current email address. Please check your inbox to confirm the change.`,
      );
      form.reset({ name: data.name, username: data.username, email: session.user.email });
      void router.invalidate();
    }
  };

  const handleResendVerificationEmail = async () => {
    const toastId = toast.loading(t`Resending verification email...`);

    const { error } = await authClient.sendVerificationEmail({
      email: session.user.email,
      callbackURL: "/dashboard/settings/profile",
    });

    if (error) {
      toast.error(error.message, { id: toastId });
      return;
    }

    toast.success(
      t`A new verification link has been sent to your email address. Please check your inbox to verify your account.`,
      { id: toastId },
    );
    void router.invalidate();
  };

  const adminRoleBadge =
    data.role === null
      ? null
      : match(data.role)
          .with("skill_verdict_admin", () => (
            <Badge variant="secondary">
              <Trans>Skill Verdict Admin</Trans>
            </Badge>
          ))
          .with("reviewer_admin", () => (
            <Badge variant="secondary">
              <Trans>Reviewer Admin</Trans>
            </Badge>
          ))
          .exhaustive();

  return (
    <div className="space-y-4">
      <DashboardHeader icon={UserCircleIcon} title={t`Profile`} />
      {adminRoleBadge}

      <Separator />

      <Form {...form}>
        <motion.form
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          style={{ willChange: "transform, opacity" }}
          className="grid w-full gap-6"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Name</Trans>
                </FormLabel>
                <FormControl
                  render={<Input min={3} max={64} autoComplete="name" placeholder="John Doe" {...field} />}
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Username</Trans>
                </FormLabel>
                <FormControl
                  render={
                    <Input
                      min={3}
                      max={64}
                      autoComplete="username"
                      placeholder="john.doe"
                      className="lowercase"
                      {...field}
                    />
                  }
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Email Address</Trans>
                </FormLabel>
                <FormControl
                  render={
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="john.doe@example.com"
                      className="lowercase"
                      {...field}
                    />
                  }
                />
                <FormMessage />
                {match(session.user.emailVerified)
                  .with(true, () => (
                    <p className="flex items-center gap-x-1.5 text-xs text-green-700">
                      <CheckIcon />
                      <Trans>Verified</Trans>
                    </p>
                  ))
                  .with(false, () => (
                    <p className="flex items-center gap-x-1.5 text-xs text-amber-600">
                      <WarningIcon className="size-3.5" />
                      <Trans>Unverified</Trans>
                      <span>|</span>
                      <Button
                        variant="link"
                        className="h-auto gap-x-1.5 p-0! text-xs text-inherit"
                        onClick={handleResendVerificationEmail}
                      >
                        <Trans>Resend verification email</Trans>
                      </Button>
                    </p>
                  ))
                  .exhaustive()}
              </FormItem>
            )}
          />

          <AnimatePresence initial={false} mode="popLayout">
            {form.formState.isDirty && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                style={{ willChange: "transform, opacity" }}
                className="flex items-center gap-x-4 justify-self-end"
              >
                <Button type="reset" variant="ghost" onClick={onCancel}>
                  <Trans>Cancel</Trans>
                </Button>

                <Button type="submit">
                  <Trans>Save Changes</Trans>
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.form>
      </Form>

      {data.role !== "skill_verdict_admin" && data.role !== "reviewer_admin" && (
        <>
          <Separator />
          <IdentityVerificationBlock />
        </>
      )}
    </div>
  );
}

function IdentityVerificationBlock() {
  const { data: calLink } = useSuspenseQuery(orpc.verification.getCalLink.queryOptions());
  const { data: identityStatus, refetch } = useSuspenseQuery(orpc.verification.getIdentityStatus.queryOptions());

  const { mutate: requestIdentity, isPending } = useMutation(orpc.verification.requestIdentity.mutationOptions());

  const { mutate: cancelIdentity, isPending: isCancelling } = useMutation({
    ...orpc.verification.cancelIdentity.mutationOptions(),
    onSuccess: () => {
      void refetch();
      toast.success(t`Identity verification request cancelled.`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const status: string = identityStatus?.status ?? "not_requested";

  const handleRequest = () => {
    requestIdentity(undefined, {
      onSuccess: () => {
        void refetch();
        toast.success(t`Identity verification requested. Please check your email for next steps.`);
        if (calLink) {
          window.open(calLink, "_blank");
        }
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  };

  const statusBadge = match(status)
    .with("verified", () => (
      <span className="flex items-center gap-x-1 text-xs font-medium text-green-700">
        <CheckIcon className="size-3.5" />
        <Trans>Verified</Trans>
      </span>
    ))
    .with("pending", "claimed", "verdict_pending", () => (
      <span className="flex items-center gap-x-1 text-xs font-medium text-amber-600">
        <ClockIcon className="size-3.5" />
        <Trans>Pending</Trans>
      </span>
    ))
    .otherwise(() => (
      <span className="text-xs font-medium text-muted-foreground">
        <Trans>Unverified</Trans>
      </span>
    ));

  return (
    <div className="grid w-full gap-3" data-testid="identity-verification-block">
      <h3 className="flex items-center gap-x-2 text-sm font-medium">
        <SealCheckIcon className="size-4" />
        <Trans>Identity Verification</Trans>
        <span className="mx-1 text-muted-foreground/40">·</span>
        {statusBadge}
      </h3>

      {match(status)
        .with("not_requested", () => (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              <Trans>Verify your identity through a short video call. This adds trust to your resume.</Trans>
            </p>
            {calLink ? (
              <Button size="sm" onClick={handleRequest} disabled={isPending}>
                <CalendarCheckIcon className="mr-2 size-4" />
                <Trans>Schedule Identity Verification</Trans>
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground/60">
                <Trans>Scheduling is not currently available.</Trans>
              </p>
            )}
          </div>
        ))
        .with("pending", "claimed", "verdict_pending", () => (
          <div className="space-y-3" data-testid="identity-pending">
            <p className="text-xs text-muted-foreground">
              <Trans>
                Your verification call has been scheduled. Our team will review and confirm your identity shortly.
              </Trans>
            </p>
            <Button size="sm" variant="outline" onClick={() => cancelIdentity(undefined)} disabled={isCancelling}>
              <Trans>Cancel Verification</Trans>
            </Button>
          </div>
        ))
        .with("verified", () => (
          <p className="text-xs text-muted-foreground" data-testid="identity-approved">
            <Trans>Your identity has been verified and your profile is trusted.</Trans>
          </p>
        ))
        .otherwise(() => (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              <Trans>Your previous identity verification was unsuccessful. You may try again.</Trans>
            </p>
            {calLink && (
              <Button size="sm" onClick={handleRequest} disabled={isPending}>
                <CalendarCheckIcon className="mr-2 size-4" />
                <Trans>Retry Identity Verification</Trans>
              </Button>
            )}
          </div>
        ))}
    </div>
  );
}
