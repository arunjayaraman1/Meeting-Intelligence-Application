import { getCloudflareContext } from "@opennextjs/cloudflare";
interface EnvWithSecrets extends CloudflareEnv {
    MICROSOFT_CLIENT_ID: string;
    MICROSOFT_CLIENT_SECRET: string;
    MICROSOFT_TENANT_ID: string;
}
export async function GET() {
    const { env } = await getCloudflareContext({ async: true }) as unknown as { env: EnvWithSecrets };
    
    const authUrl = new URL(`https://login.microsoftonline.com/${env.MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize`);
    authUrl.searchParams.set("client_id", env.MICROSOFT_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", "http://localhost:3000/api/auth/microsoft/callback");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "OnlineMeetings.Read OnlineMeetingTranscript.Read.All OnlineMeetingRecording.Read.All User.Read offline_access");
    authUrl.searchParams.set("state", crypto.randomUUID());
    
    return Response.redirect(authUrl.toString());
}