import { clearSessionCookie } from "@/lib/session";

export async function GET(request: Request) {
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost:3000";
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    return new Response(null, {
        status: 302,
        headers: {
            "Location": `${protocol}://${host}/`,
            "Set-Cookie": clearSessionCookie(),
        },
    });
}
