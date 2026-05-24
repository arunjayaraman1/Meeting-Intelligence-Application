import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getUserByEmail, createUser, updateUserTokens } from "@/lib/db";
import { setSessionCookie } from "@/lib/session";

interface EnvWithSecrets extends CloudflareEnv {
    MICROSOFT_CLIENT_ID: string;
    MICROSOFT_CLIENT_SECRET: string;
    MICROSOFT_TENANT_ID: string;
    MEETING_TOKENS: KVNamespace;
}
export async function GET(request: Request) {
    const { env } = await getCloudflareContext({ async: true }) as unknown as { env: EnvWithSecrets };
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    // Handle OAuth errors
    if (error) {
        const errorDescription = url.searchParams.get("error_description");
        return Response.json(
            { error: "Authentication failed", details: errorDescription },
            { status: 400 }
        );
    }
    if (!code) {
        return Response.json(
            { error: "No authorization code received" },
            { status: 400 }
        );
    }
    // Exchange authorization code for tokens
    const tokenResponse = await fetch(`https://login.microsoftonline.com/${env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: env.MICROSOFT_CLIENT_ID,
            client_secret: env.MICROSOFT_CLIENT_SECRET,
            code: code,

            redirect_uri: `${request.headers.get("x-forwarded-proto") || "http"}://${request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost:3000"}/api/auth/microsoft/callback`,

            grant_type: "authorization_code",
        }),
    });
    const tokens = await tokenResponse.json() as Record<string, string>;
    if (!tokenResponse.ok) {
        console.error("Token exchange failed:", tokens);
        return Response.json(
            { error: "Failed to exchange code for tokens", details: tokens.error_description },
            { status: 400 }
        );
    }
    // Fetch user info from Microsoft Graph API
    const userResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: {
            "Authorization": `Bearer ${tokens.access_token}`,
        },
    });
    if (!userResponse.ok) {
        return Response.json(
            { error: "Failed to fetch user info from Microsoft" },
            { status: 400 }
        );
    }
    const userInfo = await userResponse.json() as Record<string, string>;
    const email = userInfo.mail || userInfo.userPrincipalName;
    const name = userInfo.displayName;
    // Check if user exists in D1
    let existingUser = await getUserByEmail(email);
    let userId: number;
    if (existingUser) {
        userId = existingUser.id;
    } else {
        userId = await createUser(name, email);
    }
    // Store tokens in D1
    const expiresAt = Date.now() + (Number(tokens.expires_in) * 1000);
    await updateUserTokens(userId, tokens.access_token, tokens.refresh_token, expiresAt);
    // Store tokens in KV for fast retrieval
    await env.MEETING_TOKENS.put(
        `user:${userId}`,
        JSON.stringify({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: expiresAt,
        })
    );
    // Redirect to dashboard with session cookie
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost:3000";
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    return new Response(null, {
        status: 302,
        headers: {
            "Location": `${protocol}://${host}/dashboard`,
            "Set-Cookie": setSessionCookie(userId),
        },
    });
}