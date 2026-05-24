import { getActionItemsByMeetingId, getDb } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export async function GET(request: Request) {
    const userId = getSessionUserId(request);
    if (!userId) {
        return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const url = new URL(request.url);
    const meetingId = url.searchParams.get("meetingId");

    if (!meetingId) {
        return Response.json({ error: "meetingId is required" }, { status: 400 });
    }

    const db = await getDb();
    const meeting = await db.prepare("SELECT id FROM meetings WHERE id = ? AND user_id = ?").bind(parseInt(meetingId), userId).first();
    if (!meeting) {
        return Response.json({ error: "Meeting not found" }, { status: 404 });
    }

    const actionItems = await getActionItemsByMeetingId(parseInt(meetingId));
    return Response.json(actionItems);
}

export async function PATCH(request: Request) {
    const userId = getSessionUserId(request);
    if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

    const { id, status } = await request.json() as { id: number; status: string };
    if (!id || !["open", "done"].includes(status)) {
        return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    const db = await getDb();
    await db.prepare(
        "UPDATE action_items SET status = ? WHERE id = ? AND meeting_id IN (SELECT id FROM meetings WHERE user_id = ?)"
    ).bind(status, id, userId).run();

    return Response.json({ success: true });
}
