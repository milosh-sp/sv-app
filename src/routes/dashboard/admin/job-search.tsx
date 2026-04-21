import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { BriefcaseIcon, CheckCircleIcon, InfoIcon, XCircleIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useIsClient } from "usehooks-ts";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { orpc } from "@/integrations/orpc/client";

import { DashboardHeader } from "../-components/header";

export const Route = createFileRoute("/dashboard/admin/job-search")({
  component: RouteComponent,
});

type TestStatus = "unverified" | "success" | "failure";

function AdminJobSearchForm() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    ...orpc.admin.jobSearch.getSettings.queryOptions(),
    retry: false,
  });

  const [apiKey, setApiKey] = useState("");
  const [testStatus, setTestStatus] = useState<TestStatus>("unverified");

  useEffect(() => {
    if (!settings || isLoading) return;
    setTestStatus(settings.connectionTestOk ? "success" : "unverified");
    setApiKey("");
  }, [settings, isLoading]);

  const { mutate: testConnection, isPending: isTestingForm } = useMutation(
    orpc.admin.jobSearch.testConnection.mutationOptions(),
  );
  const { mutate: testStoredConnection, isPending: isTestingStored } = useMutation(
    orpc.admin.jobSearch.testStoredConnection.mutationOptions(),
  );
  const isTesting = isTestingForm || isTestingStored;

  const { mutate: saveSettings, isPending: isSaving } = useMutation({
    ...orpc.admin.jobSearch.setSettings.mutationOptions(),
    onSuccess: (result) => {
      setTestStatus(result.testOk ? "success" : "failure");
      void queryClient.invalidateQueries({
        queryKey: orpc.admin.jobSearch.getSettings.queryOptions().queryKey,
      });
      void queryClient.invalidateQueries({
        queryKey: orpc.jobs.getAvailability.queryOptions().queryKey,
      });
      toast.success(result.testOk ? t`Settings saved` : t`Saved, but the connection test did not succeed`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleTestConnection = () => {
    const onDone = (data: { success: boolean }) => {
      setTestStatus(data.success ? "success" : "failure");
    };
    const onErr = (error: Error) => {
      setTestStatus("failure");
      toast.error(error.message);
    };

    if (apiKey.trim().length > 0) {
      testConnection({ apiKey: apiKey.trim() }, { onSuccess: onDone, onError: onErr });
      return;
    }

    if (settings?.apiKeySet) {
      testStoredConnection(undefined, { onSuccess: onDone, onError: onErr });
      return;
    }

    toast.error(t`Enter an API key before testing.`);
  };

  const handleSave = () => {
    saveSettings({ apiKey });
  };

  if (isLoading || !settings) {
    return (
      <div className="flex items-center gap-x-2 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        <Trans>Loading…</Trans>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-y-2">
        <Label htmlFor="admin-job-search-api-key">
          <Trans>RapidAPI Key</Trans>
        </Label>
        <Input
          id="admin-job-search-api-key"
          name="admin-job-search-api-key"
          type="password"
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value);
            setTestStatus("unverified");
          }}
          placeholder={settings.apiKeySet ? t`Leave blank to keep the existing key` : undefined}
          autoCorrect="off"
          autoComplete="off"
          spellCheck="false"
          autoCapitalize="off"
          data-lpignore="true"
          data-bwignore="true"
          data-1p-ignore="true"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" disabled={isTesting} onClick={handleTestConnection}>
          {isTesting ? (
            <Spinner />
          ) : testStatus === "success" ? (
            <CheckCircleIcon className="text-success" />
          ) : testStatus === "failure" ? (
            <XCircleIcon className="text-destructive" />
          ) : null}
          <Trans>Test connection</Trans>
        </Button>

        <Button variant="default" disabled={isSaving} onClick={handleSave}>
          {isSaving ? <Spinner /> : null}
          <Trans>Save and verify</Trans>
        </Button>
      </div>
    </div>
  );
}

function RouteComponent() {
  const isClient = useIsClient();

  const { isError } = useQuery({
    ...orpc.admin.jobSearch.getSettings.queryOptions(),
    retry: false,
  });

  if (!isClient) return null;

  if (isError) {
    return null;
  }

  return (
    <div className="space-y-4">
      <DashboardHeader icon={BriefcaseIcon} title={t`Job Search API`} />

      <Separator />

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        style={{ willChange: "transform, opacity" }}
        className="grid w-full gap-6"
      >
        <div className="flex items-start gap-4 rounded-md border bg-popover p-6">
          <div className="rounded-md bg-primary/10 p-2.5">
            <InfoIcon className="text-primary" size={24} />
          </div>

          <div className="flex-1 space-y-2">
            <h3 className="font-semibold">
              <Trans>Organization-wide Job Search</Trans>
            </h3>

            <p className="leading-relaxed text-muted-foreground">
              <Trans>
                The RapidAPI key is stored in the database and used for all users. Once configured and verified, every
                signed-in user can search for job listings via the JSearch API. Only Skill Verdict administrators can
                change this configuration.
              </Trans>
            </p>
          </div>
        </div>

        <Separator />

        <AdminJobSearchForm />
      </motion.div>
    </div>
  );
}
