import { getDb, getMeetingsByUserId } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export async function GET(request: Request) {
    const userId = getSessionUserId(request);
    if (!userId) {
        return Response.json({ user: null, meetings: [] }, { status: 401 });
    }

    const db = await getDb();
    const user = await db.prepare("SELECT id, email, name FROM users WHERE id = ?").bind(userId).first<{ id: number; email: string; name: string }>();

    if (!user) {
        return Response.json({ user: null, meetings: [] }, { status: 401 });
    }

    const meetings = await getMeetingsByUserId(user.id);
    return Response.json({ user, meetings });
}