import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb, getMeetingsByUserId } from "@/lib/db";
export async function GET() {
    const db = await getDb();
    
    // For now, get the first user (we'll add proper session auth later)
    const user = await db.prepare("SELECT id, email, name FROM users LIMIT 1").first<{ id: number; email: string; name: string }>();
    
    if (!user) {
        return Response.json({ user: null, meetings: [] });
    }
    
    const meetings = await getMeetingsByUserId(user.id) ;
    
    return Response.json({ user, meetings });
}