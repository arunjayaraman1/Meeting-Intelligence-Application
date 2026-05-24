import { getDb } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export async function POST(request: Request) {
    const userId = getSessionUserId(request);
    if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

    const { query } = await request.json() as { query?: string };
    if (!query?.trim()) return Response.json({ error: "Provide a query" }, { status: 400 });

    const db = await getDb();
    const term = `%${query}%`;
    const { results } = await db.prepare(
        "SELECT * FROM meetings WHERE user_id = ? AND (title LIKE ? OR summary LIKE ? OR transcript LIKE ?) LIMIT 10"
    ).bind(userId, term, term, term).all();

    return Response.json({ results, count: results.length });
}
