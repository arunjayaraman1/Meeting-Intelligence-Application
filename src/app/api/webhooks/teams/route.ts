import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb, createMeeting, createActionItems } from "@/lib/db";
import { getOnlineMeetingByJoinUrl, getMeetingTranscript } from "@/lib/graph";
import { processMeeting } from "@/lib/ai";

interface Env extends CloudflareEnv {
    MEETING_TOKENS: KVNamespace;
    MY_DB: D1Database;
    AI: Ai;
}

interface CalendarEvent {
    id: string;
    subject: string;
    start: { dateTime: string };
    end: { dateTime: string };
    isOnlineMeeting: boolean;
    onlineMeeting: { joinUrl: string } | null;
}

async function processEvent(eventId: string, userId: number, env: Env) {
    try {
        const tokensRaw = await env.MEETING_TOKENS.get(`user:${userId}`);
        if (!tokensRaw) return;
        const { access_token: accessToken } = JSON.parse(tokensRaw) as { access_token: string };

        const eventRes = await fetch(
            `https://graph.microsoft.com/v1.0/me/events/${eventId}?$select=id,subject,start,end,isOnlineMeeting,onlineMeeting`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!eventRes.ok) return;

        const event = await eventRes.json() as CalendarEvent;
        if (!event.isOnlineMeeting || !event.onlineMeeting?.joinUrl) return;

        // Only process meetings that have already ended
        const endTime = new Date(event.end.dateTime);
        const now = new Date();
        if (endTime > now) {
            console.log(`Webhook: meeting "${event.subject}" hasn't ended yet (ends ${event.end.dateTime}), skipping`);
            return;
        }

        // Skip if meeting ended more than 24 hours ago (transcript window passed)
        const hoursAgo = (now.getTime() - endTime.getTime()) / (1000 * 60 * 60);
        if (hoursAgo > 24) {
            console.log(`Webhook: meeting "${event.subject}" ended >24h ago, skipping`);
            return;
        }

        const db = await getDb();
        const existing = await db.prepare("SELECT id, status FROM meetings WHERE teams_meeting_id = ?")
            .bind(event.id).first<{ id: number; status: string }>();

        // Don't re-process meetings already done
        if (existing?.status === "processed") {
            console.log(`Webhook: meeting ${existing.id} already processed, skipping`);
            return;
        }

        const meetingDbId = existing?.id ?? await createMeeting(userId, event.id, event.subject || "Unknown Meeting", event.start.dateTime);

        const onlineMeeting = await getOnlineMeetingByJoinUrl(accessToken, event.onlineMeeting.joinUrl);
        if (!onlineMeeting) {
            console.log(`Webhook: could not find online meeting for "${event.subject}"`);
            return;
        }

        const transcript = await getMeetingTranscript(accessToken, onlineMeeting.id);
        if (!transcript || transcript.length < 10) {
            await db.prepare("UPDATE meetings SET status = 'no_transcript' WHERE id = ?").bind(meetingDbId).run();
            console.log(`Webhook: no transcript available for "${event.subject}"`);
            return;
        }

        await db.prepare("UPDATE meetings SET transcript = ?, status = 'transcript_fetched' WHERE id = ?")
            .bind(transcript, meetingDbId).run();

        const aiResult = await processMeeting(transcript);
        await db.prepare("UPDATE meetings SET summary = ?, key_decisions = ?, status = 'processed' WHERE id = ?")
            .bind(aiResult.summary, JSON.stringify(aiResult.keyDecisions), meetingDbId).run();

        if (aiResult.actionItems.length > 0) await createActionItems(meetingDbId, aiResult.actionItems.map(a => ({ ...a, dueDate: a.dueDate ?? undefined })));

        console.log(`Webhook: processed meeting ${meetingDbId} ("${event.subject}") for user ${userId} — ${aiResult.actionItems.length} action items`);
    } catch (error) {
        console.error("processEvent error:", error);
    }
}

export async function GET(request: Request) {
    const token = new URL(request.url).searchParams.get("validationToken");
    return token
        ? new Response(token, { headers: { "Content-Type": "text/plain" } })
        : new Response("OK");
}

export async function POST(request: Request) {
    const token = new URL(request.url).searchParams.get("validationToken");
    if (token) return new Response(token, { headers: { "Content-Type": "text/plain" } });

    const { env, ctx } = await getCloudflareContext({ async: true }) as unknown as { env: Env; ctx: ExecutionContext };

    try {
        const body = await request.json() as {
            value: Array<{ resourceData?: { id: string }; clientState?: string }>
        };

        const subRaw = await env.MEETING_TOKENS.get("graph:subscription:meetings");
        const sub = subRaw ? JSON.parse(subRaw) as { userId: number; id: string } : null;
        if (!sub?.userId) return new Response("Accepted", { status: 202 });

        for (const notif of body.value) {
            const eventId = notif.resourceData?.id;
            if (eventId) ctx.waitUntil(processEvent(eventId, sub.userId, env));
        }
    } catch (e) {
        console.error("Webhook error:", e);
    }

    return new Response("Accepted", { status: 202 });
}
