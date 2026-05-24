"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

interface ActionItem {
    id: number; description: string; assigned_to: string;
    due_date: string; status: string; priority: string;
    kanban_column: string | null;
}

interface MeetingDetail {
    id: number; title: string; start_time: string; end_time: string;
    duration_minutes: number; organizer: string; attendees: string[];
    transcript: string; summary: string; key_decisions: string[];
    status: string; recording_url: string; actionItems: ActionItem[];
}

const statusConfig: Record<string, { label: string; className: string }> = {
    processed:         { label: "Processed",        className: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800" },
    transcript_fetched:{ label: "Transcript ready", className: "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800" },
    processing:        { label: "Processing",       className: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800" },
    failed:            { label: "Failed",           className: "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800" },
    no_transcript:     { label: "No transcript",    className: "bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600" },
};

function highlight(text: string, query: string): React.ReactNode {
    if (!query.trim()) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = text.split(new RegExp(`(${escaped})`, "gi"));
    return parts.map((part, i) =>
        new RegExp(`^${escaped}$`, "i").test(part)
            ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-800/60 font-semibold rounded-sm not-italic">{part}</mark>
            : part
    );
}

function countMatches(text: string, query: string): number {
    if (!query.trim()) return 0;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return (text.match(new RegExp(escaped, "gi")) || []).length;
}

export default function MeetingDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [showTranscript, setShowTranscript] = useState(false);
    const [actionItems, setActionItems] = useState<ActionItem[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const transcriptRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetch(`/api/meetings/${params.id}`)
            .then(res => {
                if (res.status === 401) { router.push("/"); return null; }
                if (!res.ok) { router.push("/dashboard"); return null; }
                return res.json() as Promise<MeetingDetail>;
            })
            .then(data => {
                if (!data) return;
                setMeeting(data);
                setActionItems(data.actionItems ?? []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [params.id, router]);

    const toggleActionItem = async (item: ActionItem) => {
        const newStatus = item.status === "done" ? "open" : "done";
        setActionItems(prev => prev.map(a => a.id === item.id ? { ...a, status: newStatus } : a));
        await fetch("/api/action-items", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: item.id, status: newStatus }),
        });
    };

    const addToBoard = useCallback(async (itemId: number) => {
        setActionItems(prev => prev.map(a => a.id === itemId ? { ...a, kanban_column: "backlog" } : a));
        await fetch("/api/kanban", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: itemId, kanban_column: "backlog" }),
        });
    }, []);

    const addAllToBoard = useCallback(async () => {
        if (!meeting) return;
        setActionItems(prev => prev.map(a => ({ ...a, kanban_column: a.kanban_column ?? "backlog" })));
        await fetch("/api/kanban", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ meetingId: meeting.id, kanban_column: "backlog" }),
        });
    }, [meeting]);

    // Auto-expand + scroll transcript when query matches transcript
    useEffect(() => {
        if (!searchQuery.trim() || !meeting?.transcript) return;
        const hasTranscriptMatch = countMatches(meeting.transcript, searchQuery) > 0;
        if (hasTranscriptMatch) {
            setShowTranscript(true);
            setTimeout(() => transcriptRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
        }
    }, [searchQuery, meeting]);

    if (loading) {
        return (
            <div className="p-8 max-w-4xl">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32 mb-8 animate-pulse" />
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 mb-4 animate-pulse">
                    <div className="h-7 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-4" />
                    <div className="h-4 bg-slate-100 dark:bg-slate-700/60 rounded w-1/3" />
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 animate-pulse">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-20 mb-4" />
                    <div className="h-3 bg-slate-100 dark:bg-slate-700/60 rounded w-full mb-2" />
                    <div className="h-3 bg-slate-100 dark:bg-slate-700/60 rounded w-4/5" />
                </div>
            </div>
        );
    }

    if (!meeting) return null;

    const s = statusConfig[meeting.status] ?? { label: meeting.status, className: "bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600" };
    const openItems = actionItems.filter(a => a.status !== "done");
    const doneItems = actionItems.filter(a => a.status === "done");

    // Compute total match count across all sections
    const matchCount = searchQuery.trim() ? (
        countMatches(meeting.summary ?? "", searchQuery) +
        (meeting.key_decisions ?? []).reduce((sum, d) => sum + countMatches(d, searchQuery), 0) +
        actionItems.reduce((sum, a) => sum + countMatches(a.description, searchQuery), 0) +
        countMatches(meeting.transcript ?? "", searchQuery)
    ) : 0;

    return (
        <div className="p-8 max-w-4xl">
            {/* Back link */}
            <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors mb-6">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                Back to Meetings
            </Link>

            {/* Meeting header */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 mb-4">
                <div className="flex items-start justify-between gap-4 mb-4">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-tight">{meeting.title}</h1>
                    <span className={`flex-shrink-0 px-3 py-1 text-xs font-medium rounded-full ${s.className}`}>{s.label}</span>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        {new Date(meeting.start_time).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                    </span>
                    {meeting.duration_minutes > 0 && (
                        <span className="flex items-center gap-1.5">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            {meeting.duration_minutes} min
                        </span>
                    )}
                    {meeting.organizer && (
                        <span className="flex items-center gap-1.5">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            {meeting.organizer}
                        </span>
                    )}
                </div>
                {meeting.attendees?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {meeting.attendees.map((a, i) => (
                            <span key={i} className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs rounded-full">{a}</span>
                        ))}
                    </div>
                )}
            </div>

            {/* Search within meeting */}
            <div className="relative mb-4">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search in this meeting…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-28 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-400 dark:focus:ring-violet-600"
                />
                {searchQuery && (
                    <>
                        <span className="absolute right-9 top-1/2 -translate-y-1/2 text-xs text-slate-400 dark:text-slate-500 pointer-events-none">
                            {matchCount} {matchCount === 1 ? "match" : "matches"}
                        </span>
                        <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </>
                )}
            </div>

            {/* Summary */}
            {meeting.summary && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 mb-4">
                    <h2 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Summary</h2>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{highlight(meeting.summary, searchQuery)}</p>
                </div>
            )}

            {/* Key decisions + Action items */}
            {(meeting.key_decisions?.length > 0 || actionItems.length > 0) && (
                <div className={`grid gap-4 mb-4 ${meeting.key_decisions?.length > 0 && actionItems.length > 0 ? "md:grid-cols-2" : ""}`}>
                    {meeting.key_decisions?.length > 0 && (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
                            <h2 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Key Decisions</h2>
                            <ul className="space-y-3">
                                {meeting.key_decisions.map((d, i) => (
                                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                                        <span className="mt-1.5 w-2 h-2 rounded-full bg-violet-500 flex-shrink-0" />
                                        {highlight(d, searchQuery)}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {actionItems.length > 0 && (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Action Items</h2>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-slate-400 dark:text-slate-500">{doneItems.length}/{actionItems.length} done</span>
                                    <button
                                        onClick={addAllToBoard}
                                        className="text-xs text-slate-400 dark:text-slate-500 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                                    >
                                        Add all to Board
                                    </button>
                                </div>
                            </div>
                            {/* Progress bar */}
                            <div className="h-1 bg-slate-100 dark:bg-slate-700 rounded-full mb-4 overflow-hidden">
                                <div
                                    className="h-full bg-violet-500 rounded-full transition-all duration-300"
                                    style={{ width: `${(doneItems.length / actionItems.length) * 100}%` }}
                                />
                            </div>
                            <ul className="space-y-3">
                                {actionItems.map((item) => (
                                    <li key={item.id} className="flex items-start gap-2.5">
                                        <button
                                            onClick={() => toggleActionItem(item)}
                                            className="mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-150 hover:border-violet-500 dark:hover:border-violet-400"
                                            style={{ borderColor: item.status === "done" ? "#7c3aed" : undefined, backgroundColor: item.status === "done" ? "#7c3aed" : undefined }}
                                        >
                                            {item.status === "done" && (
                                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                            )}
                                        </button>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm transition-all ${item.status === "done" ? "line-through text-slate-400 dark:text-slate-600" : "text-slate-700 dark:text-slate-300"}`}>
                                                {highlight(item.description, searchQuery)}
                                            </p>
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                {item.assigned_to && (
                                                    <span className="text-xs font-medium text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 px-2 py-0.5 rounded-full">{item.assigned_to}</span>
                                                )}
                                                {item.due_date && (
                                                    <span className="text-xs text-slate-400 dark:text-slate-500">Due {new Date(item.due_date).toLocaleDateString()}</span>
                                                )}
                                                {item.priority === "high" && (
                                                    <span className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">High priority</span>
                                                )}
                                                {item.kanban_column ? (
                                                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                        <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                                        On Board
                                                    </span>
                                                ) : (
                                                    <button
                                                        onClick={() => addToBoard(item.id)}
                                                        className="text-xs font-medium text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 px-2 py-0.5 rounded-full hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors"
                                                    >
                                                        + Board
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* No transcript state */}
            {meeting.status === "no_transcript" && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 text-center mb-4">
                    <svg className="mx-auto mb-3 text-amber-500" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <p className="text-amber-800 dark:text-amber-300 font-medium">No transcript available</p>
                    <p className="text-amber-600 dark:text-amber-400 text-sm mt-1">Make sure transcription is enabled in Microsoft Teams for this meeting.</p>
                </div>
            )}

            {/* Transcript */}
            {meeting.transcript && (
                <div ref={transcriptRef} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                    <button onClick={() => setShowTranscript(!showTranscript)} className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <h2 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Transcript</h2>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${showTranscript ? "rotate-180" : ""}`}>
                            <polyline points="6 9 12 15 18 9"/>
                        </svg>
                    </button>
                    {showTranscript && (
                        <div className="px-6 pb-6">
                            <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-h-96 overflow-y-auto bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl font-mono space-y-0.5">
                                {meeting.transcript.split("\n").map((line, i) => {
                                    const hasMatch = searchQuery.trim() && countMatches(line, searchQuery) > 0;
                                    return (
                                        <p key={i} className={`whitespace-pre-wrap ${hasMatch ? "bg-yellow-50 dark:bg-yellow-900/20 rounded" : ""}`}>
                                            {highlight(line, searchQuery)}
                                        </p>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
