import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function getDb() {
    const {env} = await getCloudflareContext({ async: true });
    return env.MY_DB;   
}

export async function getUserByEmail(email: string) {
    const db = await getDb();
    return db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<{ id: number; email: string; name: string }>();
}

export async function createUser(name: string, email: string) {
    const db = await getDb();
    const res = await db.prepare('INSERT INTO users (name, email) VALUES (?, ?)').bind(name, email).run();
    return res.meta.last_row_id;
}

export async function updateUserTokens(userId: number, accessToken:string, refreshToken: string, expiresAt: number) {
    const db = await getDb();
    await db.prepare("UPDATE users SET microsoft_access_token = ?, microsoft_refresh_token = ?, token_expires_at = ? WHERE id = ?")
        .bind(accessToken, refreshToken, expiresAt, userId)
        .run();
}

export async function createMeeting(userId: number, teamsMeetingId: string, title: string, startTime: string) {
    const db = await getDb();
    const res = await db.prepare("INSERT INTO meetings (user_id, teams_meeting_id, title, start_time, status) VALUES (?, ?, ?, ?, 'pending')"
    ).bind(userId, teamsMeetingId, title, startTime).run();
    return res.meta.last_row_id;
}

export async function getMeetingsByUserId(userId: number) {
    const db = await getDb();
    const { results } = await db.prepare(
        "SELECT * FROM meetings WHERE user_id = ? ORDER BY created_at DESC"
    ).bind(userId).all();
    return results;
}
export async function updateMeetingStatus(meetingId: number, status: string) {
    const db = await getDb();
    await db.prepare(
        "UPDATE meetings SET status = ? WHERE id = ?"
    ).bind(status, meetingId).run();
}
// Action item operations
export async function createActionItems(meetingId: number, items: Array<{ assignedTo: string; description: string; dueDate?: string }>) {
    const db = await getDb();
    for (const item of items) {
        await db.prepare(
            "INSERT INTO action_items (meeting_id, assigned_to, description, due_date) VALUES (?, ?, ?, ?)"
        ).bind(meetingId, item.assignedTo, item.description, item.dueDate || null).run();
    }
}
export async function getActionItemsByMeetingId(meetingId: number) {
    const db = await getDb();
    const { results } = await db.prepare(
        "SELECT * FROM action_items WHERE meeting_id = ? ORDER BY created_at DESC"
    ).bind(meetingId).all();
    return results;
}