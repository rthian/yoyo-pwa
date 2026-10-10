/**
 * Admin alias for event finalize (Prompt 19).
 * Prefer /api/events/[id]/finalize; kept for backward compatibility.
 */
import {
  GET as eventsGet,
  POST as eventsPost,
  DELETE as eventsDelete,
} from '../../../events/[id]/finalize/route'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, ctx: RouteParams) {
  return eventsGet(request, ctx)
}

export async function POST(request: Request, ctx: RouteParams) {
  return eventsPost(request, ctx)
}

export async function DELETE(request: Request, ctx: RouteParams) {
  return eventsDelete(request, ctx)
}
