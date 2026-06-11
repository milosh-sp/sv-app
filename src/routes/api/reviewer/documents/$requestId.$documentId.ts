import { ORPCError } from "@orpc/server";
import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";

import { auth } from "@/integrations/auth/config";
import { db } from "@/integrations/drizzle/client";
import { adminRoles } from "@/integrations/drizzle/schema";
import { verificationService } from "@/integrations/orpc/services/verification";

export const Route = createFileRoute("/api/reviewer/documents/$requestId/$documentId")({
  server: {
    handlers: {
      GET: handler,
    },
  },
});

async function handler({ request, params }: { request: Request; params: { requestId: string; documentId: string } }) {
  const session = await auth.api.getSession({ headers: request.headers });
  const viewerId = session?.user?.id;

  if (!viewerId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [role] = await db
    .select({ role: adminRoles.role })
    .from(adminRoles)
    .where(eq(adminRoles.userId, viewerId))
    .limit(1);

  if (!role || role.role !== "reviewer_admin") {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const doc = await verificationService.downloadReviewerDocument({
      requestId: params.requestId,
      documentId: params.documentId,
      adminId: viewerId,
    });

    const filename = doc.contentType === "application/pdf" ? `${doc.documentType}.pdf` : doc.documentType;

    const headers = new Headers();
    headers.set("Content-Type", doc.contentType);
    headers.set("Content-Length", String(doc.size));
    headers.set("Cache-Control", "private, no-store");
    headers.set("Content-Disposition", `inline; filename="${filename}"`);

    const body = Buffer.from(doc.data);

    return new Response(body, { headers });
  } catch (error) {
    if (error instanceof ORPCError) {
      const status =
        error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403 : error.code === "UNAUTHORIZED" ? 401 : 400;
      return new Response(error.message, { status });
    }

    const message = error instanceof Error ? error.message : "Failed to load document";
    return new Response(message, { status: 500 });
  }
}
