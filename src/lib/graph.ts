export interface CalendarEvent {
    id: string;
    subject: string;
    start: { dateTime: string; timeZone: string };
    end: { dateTime: string; timeZone: string };
    isOnlineMeeting: boolean;
    onlineMeeting: { joinUrl: string } | null;
    organizer: { emailAddress: { name: string; address: string } };
    attendees: Array<{ emailAddress: { name: string; address: string } }>;
    bodyPreview: string;
}

export interface OnlineMeeting {
    id: string;
    joinWebUrl: string;
    subject: string;
}

// List Teams meetings from the user's calendar (past 30 days to next 7 days)
export async function getUserMeetings(accessToken: string): Promise<CalendarEvent[]> {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    const end = new Date(now);
    end.setDate(end.getDate() + 7);

    const params = new URLSearchParams({
        startDateTime: start.toISOString(),
        endDateTime: end.toISOString(),
        "$select": "id,subject,start,end,isOnlineMeeting,onlineMeeting,organizer,attendees,bodyPreview",
        "$top": "50",
    });

    const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/calendarView?${params}`,
        {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Prefer": 'outlook.timezone="UTC"',
            },
        }
    );

    if (!response.ok) {
        const body = await response.text();
        if (response.status === 401) {
            throw new Error(`INVALID_TOKEN: calendarView returned 401 — ${body}`);
        }
        if (response.status === 403) {
            throw new Error(`CALENDAR_ACCESS_DENIED: calendarView returned 403 — ${body}`);
        }
        throw new Error(`Failed to fetch calendar events: ${response.status} ${response.statusText} — ${body}`);
    }

    const data = await response.json() as { value: CalendarEvent[] };
    // Filter client-side — $filter is not supported on calendarView
    return data.value.filter(e => e.isOnlineMeeting);
}

// Resolve a calendar event's joinUrl to the online meeting object (which has the ID needed for transcripts)
export async function getOnlineMeetingByJoinUrl(accessToken: string, joinUrl: string): Promise<OnlineMeeting | null> {
    const filter = `joinWebUrl eq '${joinUrl}'`;
    const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/onlineMeetings?$filter=${encodeURIComponent(filter)}`,
        { headers: { "Authorization": `Bearer ${accessToken}` } }
    );

    if (!response.ok) return null;

    const data = await response.json() as { value: OnlineMeeting[] };
    return data.value?.[0] ?? null;
}

// Fetch transcript text for an online meeting (returns plain text or null if none)
export async function getMeetingTranscript(accessToken: string, onlineMeetingId: string): Promise<string | null> {
    // Step 1: list transcripts for the meeting
    const listResponse = await fetch(
        `https://graph.microsoft.com/v1.0/me/onlineMeetings/${onlineMeetingId}/transcripts`,
        { headers: { "Authorization": `Bearer ${accessToken}` } }
    );

    if (listResponse.status === 404 || listResponse.status === 403) return null;

    if (!listResponse.ok) {
        console.warn(`Failed to list transcripts for meeting ${onlineMeetingId}: ${listResponse.status}`);
        return null;
    }

    const listData = await listResponse.json() as { value: Array<{ id: string }> };
    if (!listData.value?.length) return null;

    // Step 2: fetch the content of the most recent transcript as plain text
    const transcriptId = listData.value[0].id;
    const contentResponse = await fetch(
        `https://graph.microsoft.com/v1.0/me/onlineMeetings/${onlineMeetingId}/transcripts/${transcriptId}/content?$format=text/vtt`,
        { headers: { "Authorization": `Bearer ${accessToken}` } }
    );

    if (!contentResponse.ok) return null;

    const vttText = await contentResponse.text();
    // Strip VTT timing lines and return clean text
    return parseVttToText(vttText);
}

// Strip WebVTT formatting, returning only the spoken lines
function parseVttToText(vtt: string): string {
    return vtt
        .split("\n")
        .filter(line => {
            const trimmed = line.trim();
            if (!trimmed) return false;
            if (trimmed === "WEBVTT") return false;
            if (/^\d{2}:\d{2}/.test(trimmed)) return false; // timestamp lines
            if (/-->/.test(trimmed)) return false;           // cue timing lines
            if (/^\d+$/.test(trimmed)) return false;         // cue number lines
            return true;
        })
        .join("\n")
        .trim();
}

export async function getMeetingRecording(accessToken: string, onlineMeetingId: string) {
    const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/onlineMeetings/${onlineMeetingId}/recordings`,
        { headers: { "Authorization": `Bearer ${accessToken}` } }
    );

    if (response.status === 404) return null;
    if (!response.ok) return null;

    const data = await response.json() as { value: Array<Record<string, unknown>> };
    return data.value?.[0] ?? null;
}
