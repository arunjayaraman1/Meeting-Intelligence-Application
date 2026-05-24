import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb, createActionItems } from "@/lib/db";
import { processMeeting } from "@/lib/ai";

interface EnvWithServices extends CloudflareEnv {
    MY_DB: D1Database;
}

export async function POST(request: Request) {
    const { env } = await getCloudflareContext({ async: true }) as unknown as { env: EnvWithServices };
    
    const body = await request.json() as { meetingId?: number };
    
    const db = await getDb();
    
    let meetings;
    if (body?.meetingId) {
        const meeting = await db.prepare("SELECT id, transcript, title FROM meetings WHERE id = ? AND transcript IS NOT NULL AND transcript != ''").bind(body.meetingId).first() as { id: number; transcript: string; title: string };
        meetings = meeting ? [meeting] : [];
    } else {
        const { results } = await db.prepare("SELECT id, transcript, title FROM meetings WHERE transcript IS NOT NULL AND transcript != '' AND (summary IS NULL OR summary = '')").all() as { results: Array<{ id: number; transcript: string; title: string }> };
        meetings = results;
    }
    
    if (meetings.length === 0) {
        return Response.json({ error: "No meetings with transcripts to process" }, { status: 404 });
    }
    
    const results = [];
    
    for (const meeting of meetings) {
        try {
            console.log(`Processing meeting ${meeting.id}: ${meeting.title}`);
            
            const aiResult = await processMeeting(meeting.transcript);
            
            await db.prepare("UPDATE meetings SET summary = ?, key_decisions = ?, status = 'processed' WHERE id = ?")
                .bind(aiResult.summary, JSON.stringify(aiResult.keyDecisions), meeting.id)
                .run();
            
            if (aiResult.actionItems.length > 0) {
                await createActionItems(meeting.id, aiResult.actionItems.map(a => ({ ...a, dueDate: a.dueDate ?? undefined })));
            }
            
            results.push({
                meetingId: meeting.id,
                title: meeting.title,
                status: "processed",
                summaryLength: aiResult.summary.length,
                actionItemsCount: aiResult.actionItems.length,
                keyDecisionsCount: aiResult.keyDecisions.length
            });
            
            console.log(`Meeting ${meeting.id} processed successfully`);
        } catch (error) {
            console.error(`Failed to process meeting ${meeting.id}:`, error);
            await db.prepare("UPDATE meetings SET status = 'processing_failed' WHERE id = ?")
                .bind(meeting.id)
                .run();
            
            results.push({
                meetingId: meeting.id,
                title: meeting.title,
                status: "processing_failed",
                error: String(error)
            });
        }
    }
    
    return Response.json({ success: true, processed: results, count: results.length });
}
