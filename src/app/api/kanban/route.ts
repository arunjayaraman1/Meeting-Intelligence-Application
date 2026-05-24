import { getDb } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

const VALID_COLUMNS = ["backlog", "todo", "in_progress", "done"];

export async function GET(request: Request) {
    const userId = getSessionUserId(request);
    if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

    const db = await getDb();
    const { results } = await db.prepare(`
        SELECT ai.id, ai.description, ai.assigned_to, ai.due_date, ai.status,
               ai.priority, ai.kanban_column, m.title as meeting_title, ai.meeting_id
        FROM action_items ai
        JOIN meetings m ON ai.meeting_id = m.id
        WHERE m.user_id = ? AND ai.kanban_column IS NOT NULL
        ORDER BY ai.created_at DESC
    `).bind(userId).all();

    return Response.json(results);
}

export async function PATCH(request: Request) {
    const userId = getSessionUserId(request);
    if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

    const body = await request.json() as {
        id?: number;
        meetingId?: number;
        kanban_column: string | null;
    };

    const db = await getDb();

    if (body.kanban_column !== null && !VALID_COLUMNS.includes(body.kanban_column)) {
        return Response.json({ error: "Invalid column" }, { status: 400 });
    }

    if (body.id !== undefined) {
        // Single item move/remove
        await db.prepare(
            "UPDATE action_items SET kanban_column = ? WHERE id = ? AND meeting_id IN (SELECT id FROM meetings WHERE user_id = ?)"
        ).bind(body.kanban_column, body.id, userId).run();
    } else if (body.meetingId !== undefined) {
        // Bulk: add all items from a meeting to a column
        await db.prepare(
            "UPDATE action_items SET kanban_column = ? WHERE meeting_id = ? AND meeting_id IN (SELECT id FROM meetings WHERE user_id = ?)"
        ).bind(body.kanban_column, body.meetingId, userId).run();
    } else {
        return Response.json({ error: "Must provide id or meetingId" }, { status: 400 });
    }

    return Response.json({ success: true });
}
