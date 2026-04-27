import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/integrations/orpc/client";

/** AI is available when the server has verified global credentials; there is no per-user opt-in. */
export function useAiIntegration() {
  const { data, isSuccess, isError } = useQuery({
    ...orpc.ai.getAvailability.queryOptions(),
    staleTime: 60_000,
  });

  const serverConfigured = Boolean(data?.configured);
  const canUse = serverConfigured;

  return {
    serverConfigured,
    /** Settled after a response (success or error). `isSuccess` alone left failures stuck as "still loading". */
    isAvailabilityLoaded: isSuccess || isError,
    canUse,
  };
}
