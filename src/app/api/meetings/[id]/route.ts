import { getDb, getActionItemsByMeetingId, createActionItems } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { processMeeting } from "@/lib/ai";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const userId = getSessionUserId(request);
    if (!userId) {
        return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;
    const meetingId = parseInt(id, 10);
    if (isNaN(meetingId)) {
        return Response.json({ error: "Invalid meeting ID" }, { status: 400 });
    }

    const db = await getDb();
    const meeting = await db.prepare(
        "SELECT * FROM meetings WHERE id = ? AND user_id = ?"
    ).bind(meetingId, userId).first<{
        id: number; title: string; start_time: string; end_time: string;
        duration_minutes: number; organizer: string; attendees: string;
        transcript: string; summary: string; key_decisions: string;
        status: string; recording_url: string;
    }>();

    if (!meeting) {
        return Response.json({ error: "Meeting not found" }, { status: 404 });
    }

    const actionItems = await getActionItemsByMeetingId(meetingId);

    return Response.json({
        ...meeting,
        key_decisions: meeting.key_decisions ? JSON.parse(meeting.key_decisions) : [],
        attendees: meeting.attendees ? JSON.parse(meeting.attendees) : [],
        actionItems,
    });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const userId = getSessionUserId(request);
    if (!userId) {
        return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;
    const meetingId = parseInt(id, 10);
    if (isNaN(meetingId)) {
        return Response.json({ error: "Invalid meeting ID" }, { status: 400 });
    }

    const db = await getDb();
    const meeting = await db.prepare(
        "SELECT id FROM meetings WHERE id = ? AND user_id = ?"
    ).bind(meetingId, userId).first<{ id: number }>();

    if (!meeting) {
        return Response.json({ error: "Meeting not found" }, { status: 404 });
    }

    const body = await request.json() as { transcript: string };
    const transcript = body.transcript?.trim();
    if (!transcript || transcript.length < 10) {
        return Response.json({ error: "Transcript is too short" }, { status: 400 });
    }

    await db.prepare("UPDATE meetings SET transcript = ?, status = 'transcript_fetched' WHERE id = ?")
        .bind(transcript, meetingId).run();

    try {
        const aiResult = await processMeeting(transcript);

        await db.prepare(
            "UPDATE meetings SET summary = ?, key_decisions = ?, status = 'processed' WHERE id = ?"
        ).bind(aiResult.summary, JSON.stringify(aiResult.keyDecisions), meetingId).run();

        if (aiResult.actionItems.length > 0) {
            await db.prepare("DELETE FROM action_items WHERE meeting_id = ?").bind(meetingId).run();
            await createActionItems(meetingId, aiResult.actionItems.map(a => ({ ...a, dueDate: a.dueDate ?? undefined })));
        }

        return Response.json({ success: true, summary: aiResult.summary, actionItemsCount: aiResult.actionItems.length });
    } catch (error) {
        console.error("AI processing failed:", error);
        return Response.json({ error: "AI processing failed", details: String(error) }, { status: 500 });
    }
}
