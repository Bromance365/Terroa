import { bearer, fail, json, sameOrigin, UUID } from "@/lib/server/http";
import { deleteUpload, planReaderEnabled } from "@/lib/server/plan-service";

export const runtime = "nodejs";

/** DELETE /api/plans/{id}: removes the file and the extraction at once; keeps an audit timestamp. */
export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return fail(403, "forbidden");
  if (!planReaderEnabled()) return fail(503, "not_configured");
  const { id } = await ctx.params;
  const token = bearer(request);
  if (!UUID.test(id) || !token) return fail(401, "unauthorized");
  const result = await deleteUpload(id, token);
  if (result === "not_found") return fail(404, "not_found");
  if (result === "server_error") return fail(500, "server_error");
  return json({ deleted: true });
}
