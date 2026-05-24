"use client";
import { useEffect, useState } from "react";

interface AnalyticsData {
    overview: {
        totalMeetings: number; processedMeetings: number;
        totalActionItems: number; totalDecisions: number;
        weeklyMeetings: number; monthlyMeetings: number;
    };
    meetingsByStatus: Array<{ status: string; count: number }>;
    topAssignees: Array<{ assigned_to: string; count: number }>;
    recentMeetings: Array<{ id: number; title: string; start_time: string; status: string; summary: string }>;
}

const statusLabels: Record<string, string> = {
    processed: "Processed", transcript_fetched: "Transcript ready",
    no_transcript: "No transcript", processing: "Processing", failed: "Failed",
};
const statusColors: Record<string, string> = {
    processed: "bg-emerald-500", transcript_fetched: "bg-blue-500",
    no_transcript: "bg-slate-400", processing: "bg-amber-500", failed: "bg-red-500",
};
const statusDots: Record<string, string> = {
    processed: "bg-emerald-500", transcript_fetched: "bg-blue-500",
    no_transcript: "bg-slate-400", processing: "bg-amber-500", failed: "bg-red-500",
};

export default function Analytics() {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/analytics")
            .then(res => res.json() as Promise<AnalyticsData>)
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="p-8">
                <div className="pb-6 border-b border-slate-200 dark:border-slate-700 mb-6">
                    <div className="h-7 bg-slate-200 dark:bg-slate-700 rounded w-32 mb-2 animate-pulse" />
                    <div className="h-4 bg-slate-100 dark:bg-slate-700/60 rounded w-48 animate-pulse" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 animate-pulse">
                            <div className="h-3 bg-slate-100 dark:bg-slate-700/60 rounded w-2/3 mb-3" />
                            <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-12" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-red-500">Failed to load analytics</p>
            </div>
        );
    }

    const statCards = [
        { label: "Total Meetings",  value: data.overview.totalMeetings,    color: "text-slate-900 dark:text-slate-100" },
        { label: "Processed",       value: data.overview.processedMeetings, color: "text-emerald-600 dark:text-emerald-400" },
        { label: "Action Items",    value: data.overview.totalActionItems,  color: "text-violet-600 dark:text-violet-400" },
        { label: "This Week",       value: data.overview.weeklyMeetings,    color: "text-blue-600 dark:text-blue-400" },
        { label: "This Month",      value: data.overview.monthlyMeetings,   color: "text-indigo-600 dark:text-indigo-400" },
        { label: "Key Decisions",   value: data.overview.totalDecisions,    color: "text-amber-600 dark:text-amber-400" },
    ];

    const totalByStatus = data.meetingsByStatus.reduce((sum, s) => sum + s.count, 0);

    return (
        <div className="p-8">
            {/* Header */}
            <div className="pb-6 border-b border-slate-200 dark:border-slate-700 mb-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Analytics</h1>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Meeting intelligence at a glance</p>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                {statCards.map((card) => (
                    <div key={card.label} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 hover:shadow-md transition-shadow">
                        <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">{card.label}</p>
                        <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
                    </div>
                ))}
            </div>

            {/* Charts row */}
            <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
                    <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">Meetings by Status</h3>
                    {data.meetingsByStatus.length === 0 ? (
                        <p className="text-slate-400 dark:text-slate-500 text-sm">No data yet</p>
                    ) : (
                        <div className="space-y-3">
                            {data.meetingsByStatus.map((item) => {
                                const pct = totalByStatus > 0 ? (item.count / totalByStatus) * 100 : 0;
                                return (
                                    <div key={item.status}>
                                        <div className="flex justify-between text-sm mb-1.5">
                                            <span className="text-slate-600 dark:text-slate-300">{statusLabels[item.status] ?? item.status}</span>
                                            <span className="font-medium text-slate-700 dark:text-slate-300">{item.count}</span>
                                        </div>
                                        <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full transition-all duration-500 ${statusColors[item.status] ?? "bg-slate-400"}`} style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
                    <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">Top Assignees</h3>
                    {data.topAssignees.length === 0 ? (
                        <p className="text-slate-400 dark:text-slate-500 text-sm">No action items assigned yet</p>
                    ) : (
                        <div className="space-y-3">
                            {data.topAssignees.map((item, i) => {
                                const maxCount = data.topAssignees[0].count;
                                const pct = (item.count / maxCount) * 100;
                                return (
                                    <div key={item.assigned_to || i}>
                                        <div className="flex justify-between text-sm mb-1.5">
                                            <span className="text-slate-600 dark:text-slate-300">{item.assigned_to || "Unassigned"}</span>
                                            <span className="font-medium text-slate-700 dark:text-slate-300">{item.count} items</span>
                                        </div>
                                        <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <div className="h-full bg-violet-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Recent meetings */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
                    <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Recent Meetings</h3>
                </div>
                {data.recentMeetings.length === 0 ? (
                    <div className="px-6 py-8 text-center text-slate-400 dark:text-slate-500 text-sm">No meetings yet</div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                        {data.recentMeetings.map((meeting) => {
                            const dot = statusDots[meeting.status] ?? "bg-slate-400";
                            const label = statusLabels[meeting.status] ?? meeting.status;
                            return (
                                <div key={meeting.id} className="px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{meeting.title}</p>
                                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                                {new Date(meeting.start_time).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className={`w-2 h-2 rounded-full ${dot}`} />
                                            <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
                                        </div>
                                    </div>
                                    {meeting.summary && (
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">{meeting.summary}</p>
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
