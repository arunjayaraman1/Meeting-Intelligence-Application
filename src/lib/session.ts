const COOKIE_NAME = "mi_uid";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function getSessionUserId(request: Request): number | null {
    const cookieHeader = request.headers.get("cookie");
    if (!cookieHeader) return null;
    const match = cookieHeader.split(";").map(c => c.trim()).find(c => c.startsWith(`${COOKIE_NAME}=`));
    if (!match) return null;
    const value = match.slice(COOKIE_NAME.length + 1);
    const id = parseInt(value, 10);
    return isNaN(id) ? null : id;
}

export function setSessionCookie(userId: number): string {
    return `${COOKIE_NAME}=${userId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_AGE}`;
}

export function clearSessionCookie(): string {
    return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}
