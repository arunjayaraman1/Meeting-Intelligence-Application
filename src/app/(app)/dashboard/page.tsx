"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface User { id: number; email: string; name: string; }
interface Meeting {
    id: number; title: string; start_time: string; status: string;
    summary: string; key_decisions: string; relevanceScore?: number;
}
interface ActionItem {
    id: number; description: string; assigned_to: string;
    due_date: string; status: string; kanban_column: string | null;
}

const statusConfig: Record<string, { label: string; dot: string; badge: string }> = {
    processed:         { label: "Processed",        dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800" },
    transcript_fetched:{ label: "Transcript ready", dot: "bg-blue-500",    badge: "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800" },
    processing:        { label: "Processing",       dot: "bg-amber-500",   badge: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800" },
    failed:            { label: "Failed",           dot: "bg-red-500",     badge: "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800" },
    no_transcript:     { label: "No transcript",    dot: "bg-slate-400",   badge: "bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600" },
    transcript_failed: { label: "Transcript failed",dot: "bg-orange-500",  badge: "bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800" },
};

function SkeletonCard() {
    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 animate-pulse">
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                    <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded-md w-2/3 mb-2" />
                    <div className="h-3 bg-slate-100 dark:bg-slate-700/60 rounded w-1/3" />
                </div>
                <div className="h-6 w-20 bg-slate-100 dark:bg-slate-700 rounded-full ml-4" />
            </div>
            <div className="h-3 bg-slate-100 dark:bg-slate-700/60 rounded w-full mb-1.5" />
            <div className="h-3 bg-slate-100 dark:bg-slate-700/60 rounded w-4/5" />
        </div>
    );
}

function Toast({ msg, type }: { msg: string; type: "info" | "error" }) {
    return (
        <div className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium max-w-sm ${
            type === "error"
                ? "bg-white dark:bg-slate-800 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
        }`}>
            <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${type === "error" ? "bg-red-500" : "bg-emerald-500"}`} />
            {msg}
        </div>
    );
}

let toastIdCounter = 0;

export default function Dashboard() {
    const [user, setUser] = useState<User | null>(null);
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [toasts, setToasts] = useState<Array<{ id: number; text: string; type: "info" | "error" }>>([]);
    const [selectedMeeting, setSelectedMeeting] = useState<number | null>(null);
    const [actionItems, setActionItems] = useState<ActionItem[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<Meeting[]>([]);
    const [searching, setSearching] = useState(false);
    const [transcriptInput, setTranscriptInput] = useState<{ meetingId: number; text: string; hasExisting: boolean } | null>(null);
    const [processingTranscript, setProcessingTranscript] = useState(false);
    const [aiAnswer, setAiAnswer] = useState("");
    // Calendar state
    const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
    const [calendarDate, setCalendarDate] = useState(() => new Date());
    const [selectedDay, setSelectedDay] = useState<string | null>(null);

    const showToast = (text: string, type: "info" | "error" = "info", ms = 5000) => {
        const id = ++toastIdCounter;
        setToasts(prev => [...prev, { id, text, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), ms);
    };

    const loadDashboard = () => {
        fetch("/api/dashboard")
            .then(res => { if (res.status === 401) { window.location.href = "/"; return null; } return res.json() as Promise<{ user: User; meetings: Meeting[] }>; })
            .then(data => { if (!data) return; setUser(data.user); setMeetings(data.meetings); setLoading(false); })
            .catch(() => setLoading(false));
    };

    useEffect(() => { loadDashboard(); }, []);

    const handleSync = async () => {
        setSyncing(true);
        showToast("Syncing and processing meetings...", "info", 30000);
        try {
            const res = await fetch("/api/meetings", { method: "POST" });
            const data = await res.json() as { success?: boolean; meetings?: Array<{ status: string }>; count?: number; error?: string; code?: string };
            if (data.success) {
                const processed = (data.meetings ?? []).filter(m => m.status === "processed").length;
                showToast(`Synced ${data.count} meetings, ${processed} processed with AI`);
                loadDashboard();
            } else if (data.code === "CALENDAR_ACCESS_DENIED") {
                showToast("Calendar access denied. Add Calendars.Read permission in Azure Portal.", "error");
            } else if (data.code === "INVALID_TOKEN") {
                showToast("Session expired — logging you out...", "error");
                setTimeout(() => { window.location.href = "/api/auth/logout"; }, 1500);
            } else {
                showToast(data.error ?? "Sync failed", "error");
            }
        } catch { showToast("Sync failed — check the browser console", "error"); }
        setSyncing(false);
    };

    const handleSubscribe = async () => {
        try {
            const res = await fetch("/api/webhooks/teams/subscribe", { method: "POST" });
            const data = await res.json() as { success?: boolean; error?: string; expiresAt?: string; details?: string };
            showToast(
                data.success ? `Auto-sync enabled until ${new Date(data.expiresAt!).toLocaleDateString()}` : data.details ?? data.error ?? "Failed",
                data.success ? "info" : "error"
            );
        } catch { showToast("Failed to enable auto-sync", "error"); }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) { setSearchResults([]); setAiAnswer(""); return; }
        setSearching(true); setAiAnswer("");
        try {
            const [searchRes, aiRes] = await Promise.all([
                fetch("/api/search", { method: "POST", body: JSON.stringify({ query: searchQuery }) }),
                fetch("/api/ai/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: searchQuery }) }),
            ]);
            const searchData = await searchRes.json() as { results: Meeting[] };
            const aiData = await aiRes.json() as { answer: string };
            setSearchResults(searchData.results);
            setAiAnswer(aiData.answer ?? "");
        } catch { setSearchResults([]); }
        setSearching(false);
    };

    const loadActionItems = async (meetingId: number) => {
        if (selectedMeeting === meetingId) { setSelectedMeeting(null); setActionItems([]); return; }
        setSelectedMeeting(meetingId);
        try {
            const res = await fetch(`/api/action-items?meetingId=${meetingId}`);
            setActionItems(await res.json() as ActionItem[]);
        } catch { setActionItems([]); }
    };

    const toggleActionItem = async (item: ActionItem) => {
        const newStatus = item.status === "done" ? "open" : "done";
        setActionItems(prev => prev.map(a => a.id === item.id ? { ...a, status: newStatus } : a));
        await fetch("/api/action-items", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: item.id, status: newStatus }),
        });
    };

    const addToBoard = async (itemId: number) => {
        setActionItems(prev => prev.map(a => a.id === itemId ? { ...a, kanban_column: "backlog" } : a));
        await fetch("/api/kanban", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: itemId, kanban_column: "backlog" }),
        });
    };

    const handleProcessTranscript = async () => {
        if (!transcriptInput?.text.trim()) return;
        setProcessingTranscript(true);
        try {
            const res = await fetch(`/api/meetings/${transcriptInput.meetingId}`, {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ transcript: transcriptInput.text }),
            });
            const data = await res.json() as { success?: boolean; error?: string; actionItemsCount?: number };
            if (data.success) {
                setTranscriptInput(null);
                showToast(`AI processed transcript — ${data.actionItemsCount} action items found`);
                loadDashboard();
            } else { showToast(data.error ?? "Processing failed", "error"); }
        } catch { showToast("Processing failed — check the console", "error"); }
        setProcessingTranscript(false);
    };

    // Calendar helpers
    const calYear = calendarDate.getFullYear();
    const calMonth = calendarDate.getMonth();
    const firstDayOfMonth = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const meetingsByDay = meetings.reduce((acc, m) => {
        const d = m.start_time.slice(0, 10);
        (acc[d] ??= []).push(m);
        return acc;
    }, {} as Record<string, Meeting[]>);
    const todayStr = new Date().toISOString().slice(0, 10);

    const displayMeetings = (() => {
        let base = searchResults.length > 0 ? searchResults : meetings;
        if (selectedDay) base = base.filter(m => m.start_time.startsWith(selectedDay));
        return base;
    })();

    if (loading) {
        return (
            <div className="p-8">
                <div className="flex items-start justify-between pb-6 border-b border-slate-200 dark:border-slate-700 mb-6">
                    <div>
                        <div className="h-7 bg-slate-200 dark:bg-slate-700 rounded-md w-32 mb-2 animate-pulse" />
                        <div className="h-4 bg-slate-100 dark:bg-slate-700/60 rounded w-48 animate-pulse" />
                    </div>
                </div>
                <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg w-full mb-6 animate-pulse" />
                <div className="space-y-3">
                    <SkeletonCard /><SkeletonCard /><SkeletonCard />
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-3">Not connected</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-6">Connect your Microsoft account to get started.</p>
                    <a href="/api/auth/microsoft" className="px-6 py-3 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700">
                        Connect with Microsoft
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8">
            {/* Floating toasts */}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
                {toasts.map(t => <Toast key={t.id} msg={t.text} type={t.type} />)}
            </div>

            {/* Header */}
            <div className="flex items-start justify-between pb-6 border-b border-slate-200 dark:border-slate-700 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Meetings</h1>
                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                        {meetings.length} meeting{meetings.length !== 1 ? "s" : ""} · Connected as {user.name}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {/* View toggle */}
                    <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                        {(["list", "calendar"] as const).map(mode => (
                            <button
                                key={mode}
                                onClick={() => { setViewMode(mode); setSelectedDay(null); }}
                                className={`px-3 py-2 text-sm font-medium transition-colors ${
                                    viewMode === mode
                                        ? "bg-violet-600 text-white"
                                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
                                }`}
                                title={mode === "list" ? "List view" : "Calendar view"}
                            >
                                {mode === "list" ? (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1" fill="currentColor"/><circle cx="3" cy="12" r="1" fill="currentColor"/><circle cx="3" cy="18" r="1" fill="currentColor"/></svg>
                                ) : (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                )}
                            </button>
                        ))}
                    </div>
                    <button onClick={handleSubscribe} className="px-4 py-2 text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm">
                        Enable Auto-Sync
                    </button>
                    <button onClick={handleSync} disabled={syncing} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm shadow-violet-200 dark:shadow-violet-900/30">
                        {syncing ? (
                            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                        ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/></svg>
                        )}
                        {syncing ? "Syncing..." : "Sync Meetings"}
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="mb-6">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                        </svg>
                        <input
                            type="text" value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                            placeholder="Ask anything about your meetings..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent shadow-sm transition-colors"
                        />
                    </div>
                    <button onClick={handleSearch} disabled={searching} className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 shadow-sm transition-colors">
                        {searching ? "Searching..." : "Search"}
                    </button>
                </div>
                {searchResults.length > 0 && (
                    <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-slate-500 dark:text-slate-400">{searchResults.length} matching meetings</p>
                        <button onClick={() => { setSearchResults([]); setAiAnswer(""); setSearchQuery(""); }} className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">Clear search</button>
                    </div>
                )}
                {aiAnswer && (
                    <div className="mt-3 p-4 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl">
                        <div className="flex items-center gap-1.5 mb-2">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="#7c3aed"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
                            <span className="text-xs font-semibold text-violet-700 dark:text-violet-400">AI Answer</span>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{aiAnswer}</p>
                    </div>
                )}
            </div>

            {/* Transcript modal */}
            {transcriptInput && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-700">
                        <div className="p-6">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">Paste Meeting Transcript</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">The AI will generate a summary, key decisions, and action items.</p>
                            {transcriptInput.hasExisting && (
                                <div className="flex items-start gap-2.5 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl mb-4">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 flex-shrink-0 mt-0.5">
                                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                                    </svg>
                                    <p className="text-sm text-amber-800 dark:text-amber-300">
                                        This will <strong>erase the existing summary, decisions, and action items</strong> and reprocess with AI.
                                    </p>
                                </div>
                            )}
                            <textarea
                                value={transcriptInput.text}
                                onChange={(e) => setTranscriptInput({ ...transcriptInput, text: e.target.value })}
                                placeholder="Paste transcript here — from Zoom, Google Meet, or any meeting notes..."
                                className="w-full h-64 px-4 py-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                                autoFocus
                            />
                            <div className="flex justify-end gap-3 mt-4">
                                <button onClick={() => setTranscriptInput(null)} disabled={processingTranscript} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">Cancel</button>
                                <button onClick={handleProcessTranscript} disabled={processingTranscript || !transcriptInput.text.trim()} className="px-4 py-2 text-sm font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                                    {processingTranscript ? "Processing with AI..." : "Process with AI"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Calendar view */}
            {viewMode === "calendar" && (
                <div className="mb-6">
                    {/* Month nav */}
                    <div className="flex items-center justify-between mb-3">
                        <button
                            onClick={() => { setCalendarDate(new Date(calYear, calMonth - 1, 1)); setSelectedDay(null); }}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-400"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                        </button>
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            {calendarDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                        </span>
                        <button
                            onClick={() => { setCalendarDate(new Date(calYear, calMonth + 1, 1)); setSelectedDay(null); }}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-400"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </button>
                    </div>

                    {/* Grid */}
                    <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-700 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
                            <div key={d} className="bg-white dark:bg-slate-800 text-center py-2 text-xs font-semibold text-slate-400 dark:text-slate-500">{d}</div>
                        ))}
                        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                            <div key={`empty-${i}`} className="bg-white dark:bg-slate-800 h-16" />
                        ))}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const dayNum = i + 1;
                            const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                            const dayMeetings = meetingsByDay[dateStr] ?? [];
                            const isSelected = selectedDay === dateStr;
                            const isToday = dateStr === todayStr;
                            return (
                                <div
                                    key={dateStr}
                                    onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                                    className={`bg-white dark:bg-slate-800 h-16 p-1.5 cursor-pointer hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors relative select-none ${
                                        isSelected ? "ring-2 ring-inset ring-violet-500 bg-violet-50/60 dark:bg-violet-900/20" : ""
                                    } ${isToday && !isSelected ? "bg-violet-50/40 dark:bg-violet-900/10" : ""}`}
                                >
                                    <span className={`text-xs font-medium ${isToday ? "text-violet-600 dark:text-violet-400" : "text-slate-600 dark:text-slate-400"}`}>
                                        {dayNum}
                                    </span>
                                    {dayMeetings.length > 0 && (
                                        <div className="flex flex-wrap gap-0.5 mt-0.5">
                                            {dayMeetings.slice(0, 3).map((m, idx) => {
                                                const dotColor = statusConfig[m.status]?.dot ?? "bg-slate-400";
                                                return <span key={idx} className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />;
                                            })}
                                            {dayMeetings.length > 3 && (
                                                <span className="text-[9px] text-slate-400 dark:text-slate-500 leading-none">+{dayMeetings.length - 3}</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Meetings list */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        {selectedDay
                            ? `Meetings on ${new Date(selectedDay + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric" })}`
                            : searchResults.length > 0 ? "Search Results" : "All Meetings"}
                    </h2>
                    {selectedDay && (
                        <button onClick={() => setSelectedDay(null)} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex items-center gap-1">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            Clear
                        </button>
                    )}
                </div>

                {displayMeetings.length === 0 ? (
                    selectedDay ? (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-10 text-center">
                            <p className="text-slate-400 dark:text-slate-500 text-sm">No meetings on this day.</p>
                        </div>
                    ) : (
                        <div className="bg-gradient-to-br from-violet-50 to-white dark:from-slate-800 dark:to-slate-900 rounded-2xl border border-violet-100 dark:border-slate-700 p-16 text-center">
                            <div className="w-20 h-20 bg-violet-100 dark:bg-violet-900/30 rounded-3xl flex items-center justify-center mx-auto mb-5">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No meetings yet</h3>
                            <p className="text-slate-400 dark:text-slate-500 text-sm max-w-xs mx-auto mb-6">Sync your Teams meetings to get AI-generated summaries, decisions, and action items.</p>
                            <button onClick={handleSync} disabled={syncing} className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors shadow-md shadow-violet-200 dark:shadow-violet-900/30">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/></svg>
                                Sync Meetings
                            </button>
                        </div>
                    )
                ) : (
                    <div className="space-y-3">
                        {displayMeetings.map((meeting) => {
                            const s = statusConfig[meeting.status] ?? { label: meeting.status, dot: "bg-slate-400", badge: "bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600" };
                            const decisions: string[] = (() => { try { const r = JSON.parse(meeting.key_decisions); return Array.isArray(r) ? r : []; } catch { return []; } })();
                            const isSelected = selectedMeeting === meeting.id;
                            return (
                                <div key={meeting.id}>
                                    <div
                                        className={`bg-white dark:bg-slate-800 border rounded-xl p-5 hover:shadow-md transition-all duration-200 cursor-pointer group ${
                                            isSelected
                                                ? "border-violet-300 dark:border-violet-700 shadow-md"
                                                : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                                        } ${meeting.status === "processed" ? "border-l-2 border-l-emerald-400 dark:border-l-emerald-600" : ""}`}
                                        onClick={() => loadActionItems(meeting.id)}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <Link
                                                    href={`/dashboard/meetings/${meeting.id}`}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="font-semibold text-slate-900 dark:text-slate-100 hover:text-violet-600 dark:hover:text-violet-400 transition-colors truncate block"
                                                >
                                                    {meeting.title}
                                                </Link>
                                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                                    {new Date(meeting.start_time).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                {meeting.relevanceScore && (
                                                    <span className="px-2 py-1 text-xs font-medium bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 rounded-full">{(meeting.relevanceScore * 100).toFixed(0)}% match</span>
                                                )}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setTranscriptInput({ meetingId: meeting.id, text: "", hasExisting: !!(meeting.summary) });
                                                    }}
                                                    className="px-3 py-1 text-xs font-medium bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600 rounded-full hover:bg-violet-50 dark:hover:bg-violet-900/20 hover:text-violet-700 dark:hover:text-violet-400 hover:border-violet-200 dark:hover:border-violet-800 transition-colors"
                                                >
                                                    + Transcript
                                                </button>
                                                <span className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${s.badge}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                                                    {s.label}
                                                </span>
                                            </div>
                                        </div>
                                        {meeting.summary && (
                                            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">{meeting.summary}</p>
                                        )}
                                        {(decisions.length > 0 || meeting.status === "processed") && (
                                            <div className="flex items-center gap-4 mt-3 text-xs text-slate-400 dark:text-slate-500">
                                                {decisions.length > 0 && (
                                                    <span className="flex items-center gap-1">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                                        {decisions.length} decision{decisions.length !== 1 ? "s" : ""}
                                                    </span>
                                                )}
                                                <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points={isSelected ? "18 15 12 9 6 15" : "6 9 12 15 18 9"}/></svg>
                                                    {isSelected ? "Hide" : "Show"} action items
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {isSelected && (
                                        <div className="ml-4 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 border-t-0 rounded-b-xl px-5 py-4">
                                            {actionItems.length === 0 ? (
                                                <p className="text-sm text-slate-400 dark:text-slate-500">No action items for this meeting.</p>
                                            ) : (
                                                <>
                                                    <div className="flex items-center justify-between mb-3">
                                                        <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Action Items</h4>
                                                        <span className="text-xs text-slate-400 dark:text-slate-500">
                                                            {actionItems.filter(a => a.status === "done").length}/{actionItems.length} done
                                                        </span>
                                                    </div>
                                                    <ul className="space-y-2">
                                                        {actionItems.map((item) => (
                                                            <li key={item.id} className="flex items-start gap-3 text-sm">
                                                                <button onClick={() => toggleActionItem(item)} className="mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-150 hover:border-violet-500 dark:hover:border-violet-400"
                                                                    style={{ borderColor: item.status === "done" ? "#7c3aed" : undefined, backgroundColor: item.status === "done" ? "#7c3aed" : undefined }}
                                                                >
                                                                    {item.status === "done" && (
                                                                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                                                    )}
                                                                </button>
                                                                <div className="flex-1 min-w-0">
                                                                    <span className={`text-slate-700 dark:text-slate-300 transition-all ${item.status === "done" ? "line-through text-slate-400 dark:text-slate-600" : ""}`}>
                                                                        {item.description}
                                                                    </span>
                                                                    <div className="flex flex-wrap gap-2 mt-1">
                                                                        {item.assigned_to && (
                                                                            <span className="text-xs font-medium text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 px-1.5 py-0.5 rounded-full">{item.assigned_to}</span>
                                                                        )}
                                                                        {item.due_date && (
                                                                            <span className="text-xs text-slate-400 dark:text-slate-500">Due {new Date(item.due_date).toLocaleDateString()}</span>
                                                                        )}
                                                                        {item.kanban_column ? (
                                                                            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded-full">✓ On Board</span>
                                                                        ) : (
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); addToBoard(item.id); }}
                                                                                className="text-xs font-medium text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 px-1.5 py-0.5 rounded-full hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors"
                                                                            >
                                                                                + Board
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
