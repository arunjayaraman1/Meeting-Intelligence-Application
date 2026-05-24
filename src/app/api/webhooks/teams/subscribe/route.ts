import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

interface Env extends CloudflareEnv { MEETING_TOKENS: KVNamespace }

export async function POST(request: Request) {
    const userId = getSessionUserId(request);
    if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

    const { env } = await getCloudflareContext({ async: true }) as unknown as { env: Env };
    const db = await getDb();
    const user = await db.prepare("SELECT id, microsoft_access_token FROM users WHERE id = ?")
        .bind(userId).first<{ id: number; microsoft_access_token: string }>();
    if (!user) return Response.json({ error: "User not found" }, { status: 401 });

    const tokensRaw = await env.MEETING_TOKENS.get(`user:${userId}`);
    const accessToken = tokensRaw
        ? (JSON.parse(tokensRaw) as { access_token: string }).access_token
        : user.microsoft_access_token;

    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost:3000";
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    const notificationUrl = `${protocol}://${host}/api/webhooks/teams`;

    const expirationDateTime = new Date(Date.now() + 4200 * 60 * 1000).toISOString();

    const res = await fetch("https://graph.microsoft.com/v1.0/subscriptions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            changeType: "created,updated",
            notificationUrl,
            resource: "me/events",
            expirationDateTime,
            clientState: "meeting-intelligence-secret-2026"
        })
    });

    if (!res.ok) {
        const details = await res.text();
        console.error("Subscription failed:", details);
        return Response.json({ error: "Subscription failed", details }, { status: 500 });
    }

    const sub = await res.json() as Record<string, string>;

    await env.MEETING_TOKENS.put("graph:subscription:meetings", JSON.stringify({
        id: sub.id,
        expiresAt: sub.expirationDateTime,
        userId,
    }));

    return Response.json({ success: true, subscriptionId: sub.id, expiresAt: sub.expirationDateTime });
}
