import { ORPCError } from "@orpc/client";
import z from "zod";

import { postFilterOptionsSchema, searchParamsSchema } from "@/schema/jobs";

import { protectedProcedure } from "../context";
import { jobsService } from "../services/jobs";
import { getGlobalJobSearchApiKeyForService } from "../services/global-job-search-settings";

async function requireGlobalJobSearchApiKey() {
  const apiKey = await getGlobalJobSearchApiKeyForService();
  if (!apiKey) {
    throw new ORPCError("SERVICE_UNAVAILABLE", {
      message: "Job search is not configured. Contact an administrator.",
    });
  }
  return apiKey;
}

export const jobsRouter = {
  getAvailability: protectedProcedure
    .route({
      method: "GET",
      path: "/jobs/availability",
      tags: ["Jobs"],
      operationId: "getJobsAvailability",
      summary: "Whether global job search is configured and ready",
      description:
        "Returns whether a Skill Verdict admin has saved and verified a global RapidAPI key. Used to enable job search for signed-in users.",
    })
    .output(z.object({ configured: z.boolean() }))
    .handler(async () => {
      const apiKey = await getGlobalJobSearchApiKeyForService();
      return { configured: apiKey !== null };
    }),

  search: protectedProcedure
    .route({
      method: "POST",
      path: "/jobs/search",
      tags: ["Jobs"],
      operationId: "searchJobs",
      summary: "Search for job listings",
      description:
        "Searches the JSearch API for job listings matching the given parameters. Results are deduplicated and optionally filtered. Requires authentication.",
      successDescription: "Job search results returned successfully.",
    })
    .input(
      z.object({
        params: searchParamsSchema,
        filters: postFilterOptionsSchema.optional(),
      }),
    )
    .errors({
      BAD_GATEWAY: {
        message: "The JSearch API returned an error or is unreachable.",
        status: 502,
      },
      SERVICE_UNAVAILABLE: {
        message: "Job search is not configured.",
        status: 503,
      },
    })
    .handler(async ({ input }) => {
      const apiKey = await requireGlobalJobSearchApiKey();
      try {
        const response = await jobsService.search(apiKey, input.params);

        let jobs = jobsService.deduplicateJobs(response.data);

        if (input.filters) {
          jobs = jobsService.applyPostFilters(jobs, input.filters);
        }

        return { data: jobs, rapidApiQuota: response.rapidApiQuota };
      } catch (error) {
        throw new ORPCError("BAD_GATEWAY", {
          message: error instanceof Error ? error.message : "Search failed",
        });
      }
    }),
};
