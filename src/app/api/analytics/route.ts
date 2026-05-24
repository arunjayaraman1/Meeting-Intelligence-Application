import { getDb } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export async function GET(request: Request) {
    const userId = getSessionUserId(request);
    if (!userId) {
        return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const db = await getDb();

    const totalMeetings = await db.prepare("SELECT COUNT(*) as count FROM meetings WHERE user_id = ?").bind(userId).first() as { count: number };
    const processedMeetings = await db.prepare("SELECT COUNT(*) as count FROM meetings WHERE user_id = ? AND status = 'processed'").bind(userId).first() as { count: number };
    const totalActionItems = await db.prepare("SELECT COUNT(*) as count FROM action_items WHERE meeting_id IN (SELECT id FROM meetings WHERE user_id = ?)").bind(userId).first() as { count: number };
    const totalDecisions = await db.prepare("SELECT COUNT(*) as count FROM meetings WHERE user_id = ? AND key_decisions IS NOT NULL AND key_decisions != ''").bind(userId).first() as { count: number };

    const weeklyMeetings = await db.prepare(
        "SELECT COUNT(*) as count FROM meetings WHERE user_id = ? AND created_at >= date('now', '-7 days')"
    ).bind(userId).first() as { count: number };

    const monthlyMeetings = await db.prepare(
        "SELECT COUNT(*) as count FROM meetings WHERE user_id = ? AND created_at >= date('now', '-30 days')"
    ).bind(userId).first() as { count: number };

    const meetingsByStatus = await db.prepare(
        "SELECT status, COUNT(*) as count FROM meetings WHERE user_id = ? GROUP BY status"
    ).bind(userId).all() as { results: Array<{ status: string; count: number }> };

    const topAssignees = await db.prepare(
        "SELECT assigned_to, COUNT(*) as count FROM action_items WHERE meeting_id IN (SELECT id FROM meetings WHERE user_id = ?) AND assigned_to IS NOT NULL AND assigned_to != '' AND assigned_to != 'Unassigned' GROUP BY assigned_to ORDER BY count DESC LIMIT 5"
    ).bind(userId).all() as { results: Array<{ assigned_to: string; count: number }> };

    const recentMeetings = await db.prepare(
        "SELECT id, title, start_time, status, summary FROM meetings WHERE user_id = ? ORDER BY created_at DESC LIMIT 5"
    ).bind(userId).all() as { results: Array<{ id: number; title: string; start_time: string; status: string; summary: string }> };
    
    return Response.json({
        overview: {
            totalMeetings: totalMeetings.count,
            processedMeetings: processedMeetings.count,
            totalActionItems: totalActionItems.count,
            totalDecisions: totalDecisions.count,
            weeklyMeetings: weeklyMeetings.count,
            monthlyMeetings: monthlyMeetings.count
        },
        meetingsByStatus: meetingsByStatus.results,
        topAssignees: topAssignees.results,
        recentMeetings: recentMeetings.results
    });
}
