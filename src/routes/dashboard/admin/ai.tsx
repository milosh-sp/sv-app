import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { BrainIcon, CheckCircleIcon, InfoIcon, XCircleIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useIsClient } from "usehooks-ts";

import type { AIProvider } from "@/integrations/orpc/services/ai";

import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { orpc } from "@/integrations/orpc/client";

import { DashboardHeader } from "../-components/header";

export const Route = createFileRoute("/dashboard/admin/ai")({
  component: RouteComponent,
});

const providerOptions: (ComboboxOption<AIProvider> & { defaultBaseURL: string })[] = [
  {
    value: "openai",
    label: "OpenAI",
    keywords: ["openai", "gpt", "chatgpt"],
    defaultBaseURL: "https://api.openai.com/v1",
  },
  {
    value: "ollama",
    label: "Ollama",
    keywords: ["ollama", "ai", "local"],
    defaultBaseURL: "http://localhost:11434",
  },
  {
    value: "anthropic",
    label: "Anthropic Claude",
    keywords: ["anthropic", "claude", "ai"],
    defaultBaseURL: "https://api.anthropic.com/v1",
  },
  {
    value: "vercel-ai-gateway",
    label: "Vercel AI Gateway",
    keywords: ["vercel", "gateway", "ai"],
    defaultBaseURL: "https://ai-gateway.vercel.sh/v1/ai",
  },
  {
    value: "gemini",
    label: "Google Gemini",
    keywords: ["gemini", "google", "bard"],
    defaultBaseURL: "https://generativelanguage.googleapis.com/v1beta",
  },
];

type TestStatus = "unverified" | "success" | "failure";

function AdminAiForm() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    ...orpc.admin.ai.getSettings.queryOptions(),
    retry: false,
  });

  const [provider, setProvider] = useState<AIProvider>("openai");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseURL, setBaseURL] = useState("");
  const [testStatus, setTestStatus] = useState<TestStatus>("unverified");
  const [hydratedSettings, setHydratedSettings] = useState<typeof settings>();

  if (settings && !isLoading && settings !== hydratedSettings) {
    setHydratedSettings(settings);
    setProvider(settings.provider);
    setModel(settings.model);
    setBaseURL(settings.baseURL);
    setTestStatus(settings.connectionTestOk ? "success" : "unverified");
    setApiKey("");
  }

  const selectedOption = useMemo(() => {
    return providerOptions.find((option) => option.value === provider);
  }, [provider]);

  const { mutate: testConnection, isPending: isTestingForm } = useMutation(
    orpc.admin.ai.testConnection.mutationOptions(),
  );
  const { mutate: testStoredConnection, isPending: isTestingStored } = useMutation(
    orpc.admin.ai.testStoredConnection.mutationOptions(),
  );
  const isTesting = isTestingForm || isTestingStored;

  const { mutate: saveSettings, isPending: isSaving } = useMutation({
    ...orpc.admin.ai.setSettings.mutationOptions(),
    onSuccess: (result) => {
      setTestStatus(result.testOk ? "success" : "failure");
      void queryClient.invalidateQueries({ queryKey: orpc.admin.ai.getSettings.queryOptions().queryKey });
      void queryClient.invalidateQueries({ queryKey: orpc.ai.getAvailability.queryOptions().queryKey });
      toast.success(result.testOk ? t`Settings saved` : t`Saved, but the connection test did not succeed`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleProviderChange = (value: AIProvider | null) => {
    if (!value) return;
    setProvider(value);
    setTestStatus("unverified");
  };

  const handleTestConnection = () => {
    const onDone = (data: boolean) => {
      setTestStatus(data ? "success" : "failure");
    };
    const onErr = (error: Error) => {
      setTestStatus("failure");
      toast.error(error.message);
    };

    if (apiKey.trim().length > 0) {
      testConnection({ provider, model, apiKey: apiKey.trim(), baseURL }, { onSuccess: onDone, onError: onErr });
      return;
    }

    if (settings?.apiKeySet) {
      testStoredConnection(undefined, { onSuccess: onDone, onError: onErr });
      return;
    }

    toast.error(t`Enter an API key before testing.`);
  };

  const handleSave = () => {
    saveSettings({ provider, model, apiKey, baseURL });
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
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="flex flex-col gap-y-2">
        <Label htmlFor="admin-ai-provider">
          <Trans>Provider</Trans>
        </Label>
        <Combobox
          id="admin-ai-provider"
          value={provider}
          options={providerOptions}
          onValueChange={handleProviderChange}
        />
      </div>

      <div className="flex flex-col gap-y-2">
        <Label htmlFor="admin-ai-model">
          <Trans>Model</Trans>
        </Label>
        <Input
          id="admin-ai-model"
          name="admin-ai-model"
          type="text"
          value={model}
          onChange={(e) => {
            setModel(e.target.value);
            setTestStatus("unverified");
          }}
          placeholder={t`e.g., gpt-4, claude-3-opus, gemini-pro`}
          autoCorrect="off"
          autoComplete="off"
          spellCheck="false"
          autoCapitalize="off"
        />
      </div>

      <div className="flex flex-col gap-y-2 sm:col-span-2">
        <Label htmlFor="admin-ai-api-key">
          <Trans>API Key</Trans>
        </Label>
        <Input
          id="admin-ai-api-key"
          name="admin-ai-api-key"
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

      <div className="flex flex-col gap-y-2 sm:col-span-2">
        <Label htmlFor="admin-ai-base-url">
          <Trans>Base URL (Optional)</Trans>
        </Label>
        <Input
          id="admin-ai-base-url"
          name="admin-ai-base-url"
          type="url"
          value={baseURL}
          placeholder={selectedOption?.defaultBaseURL}
          onChange={(e) => {
            setBaseURL(e.target.value);
            setTestStatus("unverified");
          }}
          autoCorrect="off"
          autoComplete="off"
          spellCheck="false"
          autoCapitalize="off"
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
    ...orpc.admin.ai.getSettings.queryOptions(),
    retry: false,
  });

  if (!isClient) return null;

  if (isError) {
    return null;
  }

  return (
    <div className="space-y-4">
      <DashboardHeader icon={BrainIcon} title={t`Global AI`} />

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
              <Trans>Organization-wide AI</Trans>
            </h3>

            <p className="leading-relaxed text-muted-foreground">
              <Trans>
                Credentials are stored in the database and used for all users who enable AI in their account. Only Skill
                Verdict administrators can change this configuration.
              </Trans>
            </p>
          </div>
        </div>

        <Separator />

        <AdminAiForm />
      </motion.div>
    </div>
  );
}
