import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb, createMeeting, updateMeetingStatus, createActionItems } from "@/lib/db";
import { getUserMeetings, getOnlineMeetingByJoinUrl, getMeetingTranscript } from "@/lib/graph";
import { processMeeting } from "@/lib/ai";
import { getSessionUserId } from "@/lib/session";

interface EnvWithServices extends CloudflareEnv {
    MY_DB: D1Database;
    MEETING_TOKENS: KVNamespace;
    AI: Ai;
}

export async function POST(request: Request) {
    const { env } = await getCloudflareContext({ async: true }) as unknown as { env: EnvWithServices };

    const userId = getSessionUserId(request);
    if (!userId) {
        return Response.json({ error: "Not authenticated. Please sign in." }, { status: 401 });
    }

    const db = await getDb();
    const user = await db.prepare("SELECT id, microsoft_access_token FROM users WHERE id = ?").bind(userId).first() as { id: number; microsoft_access_token: string };

    if (!user?.microsoft_access_token) {
        return Response.json({ error: "No user found. Please authenticate first." }, { status: 401 });
    }

    const tokensRaw = await env.MEETING_TOKENS.get(`user:${user.id}`);
    const accessToken = tokensRaw ? (JSON.parse(tokensRaw) as { access_token: string }).access_token : user.microsoft_access_token;

    // Pre-flight: verify the token is valid with a cheap /me call
    const meResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: { "Authorization": `Bearer ${accessToken}` },
    });

    if (!meResponse.ok) {
        const meBody = await meResponse.text();
        console.error(`Token validation failed: ${meResponse.status} — ${meBody}`);
        console.error(`Token prefix: ${accessToken?.slice(0, 20) ?? "null/undefined"}`);
        return Response.json({
            error: "Your session token is invalid or expired. Please log out and sign in again.",
            code: "INVALID_TOKEN",
        }, { status: 401 });
    }

    const meData = await meResponse.json() as { userPrincipalName: string; displayName: string };
    console.log(`Token valid for: ${meData.userPrincipalName}`);

    try {
        const calendarEvents = await getUserMeetings(accessToken);
        console.log(`Fetched ${calendarEvents.length} calendar events`);

        const results = [];

        for (const event of calendarEvents) {
            const joinUrl = event.onlineMeeting?.joinUrl;
            if (!joinUrl) continue;

            const title = event.subject || "Unknown Meeting";
            const startTime = event.start.dateTime;
            const endTime = event.end.dateTime;
            const organizer = event.organizer?.emailAddress?.name || "";
            const attendeeNames = (event.attendees || [])
                .map(a => a.emailAddress?.name)
                .filter(Boolean);

            const durationMinutes = startTime && endTime
                ? Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000)
                : 0;

            // Check if already synced (use calendar event id as the unique key)
            const existing = await db.prepare("SELECT id FROM meetings WHERE teams_meeting_id = ?")
                .bind(event.id).first() as { id: number } | null;

            let meetingDbId: number;
            if (existing) {
                meetingDbId = existing.id;
            } else {
                meetingDbId = await createMeeting(user.id, event.id, title, startTime);
                // Fill in extra fields
                await db.prepare(
                    "UPDATE meetings SET end_time = ?, duration_minutes = ?, organizer = ?, attendees = ? WHERE id = ?"
                ).bind(endTime, durationMinutes, organizer, JSON.stringify(attendeeNames), meetingDbId).run();
            }

            // Resolve the calendar event to an online meeting ID for transcript fetching
            const onlineMeeting = await getOnlineMeetingByJoinUrl(accessToken, joinUrl);
            if (!onlineMeeting) {
                await updateMeetingStatus(meetingDbId, "no_transcript");
                results.push({ title, status: "no_online_meeting" });
                continue;
            }

            try {
                const transcriptText = await getMeetingTranscript(accessToken, onlineMeeting.id);

                if (transcriptText && transcriptText.length > 10) {
                    await db.prepare("UPDATE meetings SET transcript = ?, status = 'transcript_fetched' WHERE id = ?")
                        .bind(transcriptText, meetingDbId).run();

                    try {
                        const aiResult = await processMeeting(transcriptText);

                        await db.prepare(
                            "UPDATE meetings SET summary = ?, key_decisions = ?, status = 'processed' WHERE id = ?"
                        ).bind(aiResult.summary, JSON.stringify(aiResult.keyDecisions), meetingDbId).run();

                        if (aiResult.actionItems.length > 0) {
                            await createActionItems(meetingDbId, aiResult.actionItems.map(a => ({ ...a, dueDate: a.dueDate ?? undefined })));
                        }

                        results.push({
                            title,
                            status: "processed",
                            actionItemsCount: aiResult.actionItems.length,
                            keyDecisionsCount: aiResult.keyDecisions.length,
                        });
                    } catch (aiError) {
                        console.error(`AI processing failed for meeting ${event.id}:`, aiError);
                        results.push({ title, status: "transcript_fetched_ai_failed" });
                    }
                } else {
                    await updateMeetingStatus(meetingDbId, "no_transcript");
                    results.push({ title, status: "no_transcript" });
                }
            } catch (error) {
                console.error(`Failed to fetch transcript for meeting ${event.id}:`, error);
                await updateMeetingStatus(meetingDbId, "transcript_failed");
                results.push({ title, status: "transcript_failed" });
            }
        }

        return Response.json({ success: true, meetings: results, count: results.length });
    } catch (error) {
        const message = String(error);
        console.error("Failed to sync meetings:", message);

        if (message.includes("CALENDAR_ACCESS_DENIED")) {
            return Response.json({
                error: "Calendar access denied. In Azure Portal → App Registrations → your app → API Permissions: add 'Calendars.Read' (delegated) and click 'Grant admin consent'. Then log out and sign back in.",
                code: "CALENDAR_ACCESS_DENIED",
            }, { status: 403 });
        }

        if (message.includes("INVALID_TOKEN")) {
            return Response.json({
                error: "Token is invalid. Please log out and sign in again.",
                code: "INVALID_TOKEN",
            }, { status: 401 });
        }

        return Response.json({ error: "Failed to sync meetings", details: message }, { status: 500 });
    }
}
