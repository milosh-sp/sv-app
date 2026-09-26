import { ORPCError, onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { BatchHandlerPlugin, RequestHeadersPlugin, StrictGetMethodPlugin } from "@orpc/server/plugins";
import { createFileRoute } from "@tanstack/react-router";

import router from "@/integrations/orpc/router";
import { getLocale } from "@/utils/locale";

const rpcHandler = new RPCHandler(router, {
  plugins: [new BatchHandlerPlugin(), new RequestHeadersPlugin(), new StrictGetMethodPlugin()],
  interceptors: [
    onError((error) => {
      if (error instanceof ORPCError && error.status < 500) return;
      console.error("[oRPC Server]", error);
    }),
  ],
});

async function handler({ request }: { request: Request }) {
  const { response } = await rpcHandler.handle(request, {
    prefix: "/api/rpc",
    context: { locale: await getLocale() },
  });

  if (!response) return new Response("NOT_FOUND", { status: 404 });

  return response;
}

export const Route = createFileRoute("/api/rpc/$")({
  server: {
    handlers: {
      ANY: handler,
    },
  },
});
