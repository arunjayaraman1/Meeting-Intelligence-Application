import { getCloudflareContext } from "@opennextjs/cloudflare";

interface EnvWithSecrets extends CloudflareEnv {
    MICROSOFT_CLIENT_ID: string;
    MICROSOFT_CLIENT_SECRET: string;
    MICROSOFT_TENANT_ID: string;
}
export async function GET(request: Request) {
    const { env } = await getCloudflareContext({ async: true }) as unknown as { env: EnvWithSecrets };
    
    const authUrl = new URL(`https://login.microsoftonline.com/${env.MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize`);
    authUrl.searchParams.set("client_id", env.MICROSOFT_CLIENT_ID);
    // authUrl.searchParams.set("redirect_uri", "http://localhost:3000/api/auth/microsoft/callback");
    
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost:3000";
const protocol = request.headers.get("x-forwarded-proto") || "http";
const redirectUri = `${protocol}://${host}/api/auth/microsoft/callback`;
    
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "OnlineMeetings.Read OnlineMeetingTranscript.Read.All OnlineMeetingRecording.Read.All User.Read Calendars.Read offline_access");
    authUrl.searchParams.set("state", crypto.randomUUID());
    authUrl.searchParams.set("prompt", "consent");
    
    return Response.redirect(authUrl.toString());
}