import { getDb } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { generateAIAnswer } from "@/lib/ai";

export async function POST(request: Request) {
    const userId = getSessionUserId(request);
    if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

    const { question } = await request.json() as { question: string };
    if (!question?.trim()) return Response.json({ error: "No question" }, { status: 400 });

    const db = await getDb();
    const { results: meetings } = await db.prepare(
        "SELECT id, title, start_time, summary, key_decisions FROM meetings WHERE user_id = ? AND status = 'processed' LIMIT 20"
    ).bind(userId).all<{ id: number; title: string; start_time: string; summary: string; key_decisions: string }>();

    if (!meetings.length) {
        return Response.json({ answer: "No processed meetings found. Sync and process your meetings first." });
    }

    const meetingIds = meetings.map(m => m.id);
    const placeholders = meetingIds.map(() => "?").join(",");
    const { results: actionItems } = await db.prepare(
        `SELECT meeting_id, description, assigned_to, due_date FROM action_items WHERE meeting_id IN (${placeholders})`
    ).bind(...meetingIds).all<{ meeting_id: number; description: string; assigned_to: string; due_date: string }>();

    const context = meetings.map(m => {
        const decisions = m.key_decisions ? (JSON.parse(m.key_decisions) as string[]).join("; ") : "";
        const items = actionItems
            .filter(a => a.meeting_id === m.id)
            .map(a => `- ${a.description} (assigned to: ${a.assigned_to || "Unassigned"}${a.due_date ? ", due: " + a.due_date : ""})`)
            .join("\n");
        return [
            `Meeting: "${m.title}" (${m.start_time})`,
            m.summary ? `Summary: ${m.summary}` : "",
            decisions ? `Decisions: ${decisions}` : "",
            items ? `Action items:\n${items}` : "",
        ].filter(Boolean).join("\n");
    }).join("\n\n---\n\n");

    const answer = await generateAIAnswer(question, context);
    return Response.json({ answer });
}
