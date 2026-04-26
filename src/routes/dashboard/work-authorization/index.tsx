import type z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { CheckCircleIcon, GlobeIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { orpc } from "@/integrations/orpc/client";
import {
  defaultWorkAuthorizationData,
  sponsorshipRequirementSchema,
  workAuthorizationSchema,
  workAuthorizationStatusSchema,
} from "@/schema/resume/data";

import { DashboardHeader } from "../-components/header";

export const Route = createFileRoute("/dashboard/work-authorization/")({
  component: RouteComponent,
});

const formSchema = workAuthorizationSchema.pick({
  eu: true,
  usa: true,
  uk: true,
});

type FormValues = z.infer<typeof formSchema>;

const regions = ["eu", "usa", "uk"] as const;
type Region = (typeof regions)[number];

const regionLabels: Record<Region, string> = {
  eu: "EU",
  usa: "USA",
  uk: "UK",
};

const formatWorkAuthStatusLabel = (value: string) =>
  value === "needs_sponsorship" ? "requires employer sponsorship" : value.replaceAll("_", " ");

const statusOptions = workAuthorizationStatusSchema.options.map((value) => ({
  value,
  label: formatWorkAuthStatusLabel(value),
}));
const sponsorshipOptions = sponsorshipRequirementSchema.options.map((value) => ({
  value,
  label: value.replaceAll("_", " "),
}));

const normalizeToken = (value: string) => value.toLowerCase().replaceAll(" ", "_");

function buildRegionSearchTokens(region: Region, values: FormValues[Region]) {
  const tokens = [
    `work_auth:${region}:${normalizeToken(values.status)}`,
    `work_auth:${region}:sponsorship:${normalizeToken(values.sponsorshipRequired)}`,
  ];

  if (values.consentToShareWithEmployers) {
    tokens.push(`work_auth:${region}:consent:true`);
  }

  return tokens;
}

function deriveSponsorshipRequired(
  status: FormValues[Region]["status"],
  current: FormValues[Region]["sponsorshipRequired"],
) {
  if (status === "visa_holder") return current;
  if (status === "needs_sponsorship") return "yes";
  if (status === "citizen" || status === "permanent_resident") return "no";
  return "unknown";
}

function normalizeRegionValues(values: FormValues[Region], region: Region): FormValues[Region] {
  return {
    ...defaultWorkAuthorizationData[region],
    ...values,
  };
}

function RouteComponent() {
  const queryClient = useQueryClient();
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [initializedResumeId, setInitializedResumeId] = useState<string | null>(null);
  const [activeRegion, setActiveRegion] = useState<Region>("eu");
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      eu: defaultWorkAuthorizationData.eu,
      usa: defaultWorkAuthorizationData.usa,
      uk: defaultWorkAuthorizationData.uk,
    },
  });

  const { data: resumes } = useQuery(orpc.resume.list.queryOptions({ input: { tags: [], sort: "lastUpdatedAt" } }));
  const selectedResumeQuery = useQuery({
    ...orpc.resume.getById.queryOptions({ input: { id: selectedResumeId ?? "" } }),
    enabled: Boolean(selectedResumeId),
  });

  const selectedResume = selectedResumeQuery.data;
  const resumeOptions = useMemo(
    () => (resumes ?? []).map((resume) => ({ value: resume.id, label: resume.name || resume.slug })),
    [resumes],
  );

  useEffect(() => {
    if (!selectedResumeId && resumes && resumes.length > 0) {
      setSelectedResumeId(resumes[0].id);
    }
  }, [resumes, selectedResumeId]);

  useEffect(() => {
    if (!selectedResume) return;
    if (selectedResume.id === initializedResumeId) return;

    const workAuthorization = selectedResume.data.workAuthorization ?? defaultWorkAuthorizationData;
    const normalizedWorkAuthorization = {
      eu: normalizeRegionValues(workAuthorization.eu, "eu"),
      usa: normalizeRegionValues(workAuthorization.usa, "usa"),
      uk: normalizeRegionValues(workAuthorization.uk, "uk"),
    };
    form.reset({
      eu: normalizedWorkAuthorization.eu,
      usa: normalizedWorkAuthorization.usa,
      uk: normalizedWorkAuthorization.uk,
    });
    setInitializedResumeId(selectedResume.id);
  }, [selectedResume, initializedResumeId, form]);

  const watchedRegions = form.watch(regions);
  const regionOptions = useMemo(
    () =>
      regions.map((region, index) => {
        const status = watchedRegions[index]?.status;
        const isFilled = Boolean(status) && status !== "prefer_not_to_say";
        const label = isFilled
          ? `${regionLabels[region]} — ${formatWorkAuthStatusLabel(status)}`
          : regionLabels[region];

        return { value: region, label };
      }),
    [watchedRegions],
  );

  const selectedStatus = form.watch(`${activeRegion}.status` as const);
  const isVisaSelection = selectedStatus === "visa_holder";
  const isResumeLoading = Boolean(selectedResumeId) && selectedResumeQuery.isPending;

  const { mutate: updateResume, isPending } = useMutation({
    ...orpc.resume.update.mutationOptions({ meta: { noInvalidate: true } }),
    onError: (error) => {
      toast.error(error.message || t`Failed to save work authorization.`);
    },
  });

  const onSubmit = (values: FormValues) => {
    if (!selectedResume) {
      toast.error(t`Please select a resume before saving.`);
      return;
    }

    const normalizedValues = {
      eu: normalizeRegionValues(values.eu, "eu"),
      usa: normalizeRegionValues(values.usa, "usa"),
      uk: normalizeRegionValues(values.uk, "uk"),
    };
    const now = new Date().toISOString();
    const nextRegionData = {
      ...normalizedValues[activeRegion],
      sponsorshipRequired: deriveSponsorshipRequired(
        normalizedValues[activeRegion].status,
        normalizedValues[activeRegion].sponsorshipRequired,
      ),
      updatedAt: now,
      searchTokens: [],
    };
    nextRegionData.searchTokens = buildRegionSearchTokens(activeRegion, nextRegionData);
    const nextWorkAuthorization = {
      ...normalizedValues,
      [activeRegion]: nextRegionData,
    };

    updateResume(
      {
        id: selectedResume.id,
        data: {
          ...selectedResume.data,
          workAuthorization: nextWorkAuthorization,
        },
      },
      {
        onSuccess: () => {
          toast.success(t`Work authorization saved.`);
          form.reset({
            eu: nextWorkAuthorization.eu,
            usa: nextWorkAuthorization.usa,
            uk: nextWorkAuthorization.uk,
          });
          void queryClient.invalidateQueries({
            queryKey: orpc.resume.getById.queryOptions({ input: { id: selectedResume.id } }).queryKey,
          });
          void queryClient.invalidateQueries({
            queryKey: orpc.resume.list.queryOptions().queryKey,
          });
        },
      },
    );
  };

  const onInvalidSubmit = () => {
    toast.error(t`Please complete the required work authorization fields before saving.`);
  };

  return (
    <div className="space-y-4">
      <DashboardHeader icon={GlobeIcon} title={t`Work Authorization`} />

      <Separator />

      {resumeOptions.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <Trans>Create a resume first, then add your work authorization details.</Trans>
        </div>
      ) : (
        <Form {...form}>
          <form className="grid gap-6" onSubmit={form.handleSubmit(onSubmit, onInvalidSubmit)}>
            <FormItem>
              <FormLabel>
                <Trans>Resume</Trans>
              </FormLabel>
              <FormControl
                render={
                  <Combobox
                    value={selectedResumeId}
                    options={resumeOptions}
                    placeholder={t`Select resume`}
                    onValueChange={(value) => setSelectedResumeId(value)}
                  />
                }
              />
              <FormDescription>
                <Trans>Authorization details are stored per resume profile.</Trans>
              </FormDescription>
            </FormItem>

            {isResumeLoading ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                <Trans>Loading selected resume details...</Trans>
              </div>
            ) : selectedResume ? (
              <>
                <FormItem>
                  <FormLabel>
                    <Trans>Region</Trans>
                  </FormLabel>
                  <FormControl
                    render={
                      <Combobox
                        value={activeRegion}
                        options={regionOptions}
                        placeholder={t`Select region`}
                        onValueChange={(value) => {
                          if (value) setActiveRegion(value as Region);
                        }}
                      />
                    }
                  />
                  <FormDescription>
                    <Trans>
                      Pick a region to fill in your authorization details. Statuses already filled are shown next to
                      each region.
                    </Trans>
                  </FormDescription>
                </FormItem>

                <div key={activeRegion} className="grid gap-4 rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium">{regionLabels[activeRegion]}</h3>
                    {selectedStatus && selectedStatus !== "prefer_not_to_say" ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <CheckCircleIcon className="size-3.5" />
                        {formatWorkAuthStatusLabel(selectedStatus)}
                      </span>
                    ) : null}
                  </div>

                  <FormField
                    control={form.control}
                    name={`${activeRegion}.status`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <Trans>Status</Trans>
                        </FormLabel>
                        <FormControl
                          render={
                            <Combobox
                              value={field.value}
                              options={statusOptions}
                              placeholder={t`Select status`}
                              onValueChange={(value) => {
                                if (!value) return;

                                field.onChange(value);

                                if (value !== "visa_holder") {
                                  form.setValue(`${activeRegion}.visaType` as const, "", { shouldDirty: true });
                                  form.setValue(`${activeRegion}.earliestStartDate` as const, "", {
                                    shouldDirty: true,
                                  });
                                  form.setValue(`${activeRegion}.expirationMonth` as const, "", { shouldDirty: true });
                                }

                                form.setValue(
                                  `${activeRegion}.sponsorshipRequired` as const,
                                  deriveSponsorshipRequired(
                                    value,
                                    form.getValues(`${activeRegion}.sponsorshipRequired` as const),
                                  ),
                                  { shouldDirty: true },
                                );
                              }}
                            />
                          }
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {isVisaSelection ? (
                    <FormField
                      control={form.control}
                      name={`${activeRegion}.sponsorshipRequired`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            <Trans>Sponsorship required</Trans>
                          </FormLabel>
                          <FormControl
                            render={
                              <Combobox
                                value={field.value}
                                options={sponsorshipOptions}
                                placeholder={t`Select sponsorship requirement`}
                                onValueChange={(value) => {
                                  if (value) field.onChange(value);
                                }}
                              />
                            }
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : null}

                  {isVisaSelection && (
                    <>
                      <FormField
                        control={form.control}
                        name={`${activeRegion}.visaType`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              <Trans>Visa type (optional)</Trans>
                            </FormLabel>
                            <FormControl render={<Input placeholder={t`e.g. Skilled Worker`} {...field} />} />
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name={`${activeRegion}.earliestStartDate`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                <Trans>Issue date</Trans>
                              </FormLabel>
                              <FormControl
                                render={
                                  <Input
                                    type="date"
                                    className="cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:invert"
                                    onClick={(event) => event.currentTarget.showPicker?.()}
                                    onFocus={(event) => event.currentTarget.showPicker?.()}
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
                          name={`${activeRegion}.expirationMonth`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                <Trans>Expiration date</Trans>
                              </FormLabel>
                              <FormControl
                                render={
                                  <Input
                                    type="date"
                                    className="cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:invert"
                                    onClick={(event) => event.currentTarget.showPicker?.()}
                                    onFocus={(event) => event.currentTarget.showPicker?.()}
                                    {...field}
                                  />
                                }
                              />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </>
                  )}
                </div>

                <FormField
                  key={`notes-${activeRegion}`}
                  control={form.control}
                  name={`${activeRegion}.userNotes`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Notes</Trans>
                      </FormLabel>
                      <FormControl
                        render={
                          <Textarea rows={3} placeholder={t`Add extra context for recruiters (optional).`} {...field} />
                        }
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  key={`consent-${activeRegion}`}
                  control={form.control}
                  name={`${activeRegion}.consentToShareWithEmployers`}
                  render={({ field }) => (
                    <FormItem className="rounded-md border p-4">
                      <FormLabel>
                        <Trans>Consent</Trans>
                      </FormLabel>
                      <FormControl
                        render={
                          <label className="flex items-start gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={(event) => field.onChange(event.target.checked)}
                              className="mt-0.5"
                            />
                            <span>
                              <Trans>
                                I consent to sharing my work authorization details with employers for matching.
                              </Trans>
                            </span>
                          </label>
                        }
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-center justify-between gap-4">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <WarningCircleIcon className="size-3.5" />
                    <Trans>Only employers with permission can use these fields for filtering.</Trans>
                  </p>
                  <Button type="submit" disabled={isPending || isResumeLoading || !selectedResume}>
                    {isPending ? <Trans>Saving...</Trans> : <Trans>Save work authorization</Trans>}
                  </Button>
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                <Trans>Could not load the selected resume. Please choose another resume and try again.</Trans>
              </div>
            )}
          </form>
        </Form>
      )}
    </div>
  );
}
