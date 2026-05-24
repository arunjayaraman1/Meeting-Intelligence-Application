import { getCloudflareContext } from "@opennextjs/cloudflare";

interface EnvWithAI extends CloudflareEnv {
    AI: Ai;
}

interface ProcessedMeeting {
    summary: string;
    keyDecisions: string[];
    actionItems: Array<{
        description: string;
        assignedTo: string;
        dueDate: string | null;
        priority: string;
    }>;
}

const MEETING_ANALYSIS_PROMPT = `You are an expert meeting analyst. Carefully read the transcript below and extract structured meeting intelligence.

Return ONLY valid JSON with this exact structure — no markdown, no explanation, no code fences, just raw JSON:
{
  "summary": "2-3 sentence factual summary covering what was discussed, what was decided, and what happens next",
  "keyDecisions": ["Each decision made as a clear, standalone statement"],
  "actionItems": [
    {
      "description": "Specific, actionable task description",
      "assignedTo": "Person's full name or first name, or 'Unassigned'",
      "dueDate": "YYYY-MM-DD or null",
      "priority": "high|medium|low"
    }
  ]
}

Extraction rules:
- summary: factual and concise, captures the meeting outcome in plain language
- keyDecisions: only DEFINITIVE decisions made (not proposals or open discussions), empty array [] if none
- actionItems: only EXPLICIT tasks with a clear action verb, empty array [] if none
- assignedTo: extract from context — "Arun will do X" → "Arun", "assigned to Sarah" → "Sarah", unclear → "Unassigned"
- dueDate: extract from context — "by Friday" (calculate from meeting date if possible), "next week", specific dates
- priority: "high" if urgent/blocker/deadline mentioned, "low" if optional/nice-to-have, "medium" for everything else

Transcript:
{transcript}`;

export async function processMeeting(transcript: string): Promise<ProcessedMeeting> {
    const { env } = await getCloudflareContext({ async: true }) as unknown as { env: EnvWithAI };

    const response = await env.AI.run("@cf/meta/llama-3.1-70b-instruct", {
        messages: [
            {
                role: "system",
                content: "You are a meeting intelligence assistant. You extract structured data from meeting transcripts. Always respond with valid JSON only — no markdown, no explanation, just the JSON object."
            },
            {
                role: "user",
                content: MEETING_ANALYSIS_PROMPT.replace("{transcript}", transcript.slice(0, 12000))
            }
        ],
        max_tokens: 1500,
    });

    const text = (response as unknown as { response: string }).response ?? "";

    try {
        // Strip any accidental markdown fences
        const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]) as Partial<ProcessedMeeting>;
            return {
                summary: typeof parsed.summary === "string" ? parsed.summary : "Summary not available.",
                keyDecisions: Array.isArray(parsed.keyDecisions) ? parsed.keyDecisions.filter(d => typeof d === "string") : [],
                actionItems: Array.isArray(parsed.actionItems)
                    ? parsed.actionItems.filter(item => item && typeof item.description === "string").map(item => ({
                        description: item.description,
                        assignedTo: item.assignedTo ?? "Unassigned",
                        dueDate: item.dueDate ?? null,
                        priority: ["high", "medium", "low"].includes(item.priority) ? item.priority : "medium",
                    }))
                    : [],
            };
        }
    } catch (e) {
        console.error("Failed to parse AI response:", text, e);
    }

    // Fallback: return what we can
    return {
        summary: text.slice(0, 500) || "Could not generate summary.",
        keyDecisions: [],
        actionItems: [],
    };
}

export async function generateAIAnswer(question: string, context: string): Promise<string> {
    const { env } = await getCloudflareContext({ async: true }) as unknown as { env: EnvWithAI };

    const response = await env.AI.run("@cf/meta/llama-3.1-70b-instruct", {
        messages: [
            {
                role: "system",
                content: "You are a meeting assistant. Answer questions using ONLY the meeting data provided. Be concise and specific. If the answer isn't in the data, say so clearly."
            },
            {
                role: "user",
                content: `Meeting data:\n\n${context}\n\nQuestion: ${question}`
            }
        ],
        max_tokens: 400,
    });

    return (response as unknown as { response: string }).response ?? "No answer generated.";
}
