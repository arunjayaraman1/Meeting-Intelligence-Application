"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";

interface KanbanItem {
    id: number;
    description: string;
    assigned_to: string | null;
    due_date: string | null;
    status: string;
    priority: string;
    kanban_column: string;
    meeting_title: string;
    meeting_id: number;
}

const COLUMNS = [
    { id: "backlog",     label: "Backlog",     color: "text-slate-500 dark:text-slate-400",     dot: "bg-slate-400" },
    { id: "todo",        label: "Todo",        color: "text-blue-600 dark:text-blue-400",        dot: "bg-blue-500" },
    { id: "in_progress", label: "In Progress", color: "text-amber-600 dark:text-amber-400",      dot: "bg-amber-500" },
    { id: "done",        label: "Done",        color: "text-emerald-600 dark:text-emerald-400",  dot: "bg-emerald-500" },
];

interface Toast { id: number; text: string; type: "success" | "error" }
let toastId = 0;

export default function BoardPage() {
    const [items, setItems] = useState<KanbanItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [draggingId, setDraggingId] = useState<number | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const dragLeaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    const showToast = (text: string, type: Toast["type"] = "success") => {
        const id = ++toastId;
        setToasts(prev => [...prev, { id, text, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
    };

    useEffect(() => {
        fetch("/api/kanban")
            .then(res => res.json() as Promise<KanbanItem[]>)
            .then(data => { setItems(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const moveItem = async (itemId: number, newColumn: string) => {
        const previousColumn = items.find(i => i.id === itemId)?.kanban_column;
        if (previousColumn === newColumn) return;

        // Optimistic update
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, kanban_column: newColumn } : i));

        try {
            const res = await fetch("/api/kanban", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: itemId, kanban_column: newColumn }),
            });
            if (!res.ok) throw new Error();
            showToast(`Moved to ${COLUMNS.find(c => c.id === newColumn)?.label}`);
        } catch {
            // Rollback
            setItems(prev => prev.map(i => i.id === itemId ? { ...i, kanban_column: previousColumn! } : i));
            showToast("Failed to save change", "error");
        }
    };

    const handleDrop = (e: React.DragEvent, colId: string) => {
        e.preventDefault();
        const itemId = parseInt(e.dataTransfer.getData("text/plain"));
        if (!isNaN(itemId)) moveItem(itemId, colId);
        setDragOverColumn(null);
        setDraggingId(null);
    };

    const handleDragLeave = (e: React.DragEvent, colId: string) => {
        if (dragLeaveTimers.current[colId]) clearTimeout(dragLeaveTimers.current[colId]);
        dragLeaveTimers.current[colId] = setTimeout(() => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDragOverColumn(prev => prev === colId ? null : prev);
            }
        }, 50);
    };

    if (loading) {
        return (
            <div className="p-8">
                <div className="pb-6 border-b border-slate-200 dark:border-slate-700 mb-6">
                    <div className="h-7 bg-slate-200 dark:bg-slate-700 rounded w-24 mb-2 animate-pulse" />
                    <div className="h-4 bg-slate-100 dark:bg-slate-700/60 rounded w-48 animate-pulse" />
                </div>
                <div className="grid grid-cols-4 gap-4">
                    {COLUMNS.map(col => (
                        <div key={col.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-20 mb-4 animate-pulse" />
                            {[1, 2].map(i => (
                                <div key={i} className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 mb-2 animate-pulse">
                                    <div className="h-3 bg-slate-200 dark:bg-slate-600 rounded w-full mb-2" />
                                    <div className="h-3 bg-slate-200 dark:bg-slate-600 rounded w-2/3" />
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-8">
            {/* Header */}
            <div className="pb-6 border-b border-slate-200 dark:border-slate-700 mb-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Board</h1>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                    Drag action items between columns to track progress
                </p>
            </div>

            {/* Kanban grid */}
            <div className="grid grid-cols-4 gap-4 items-start">
                {COLUMNS.map(col => {
                    const colItems = items.filter(i => i.kanban_column === col.id);
                    const isOver = dragOverColumn === col.id;
                    return (
                        <div
                            key={col.id}
                            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                            onDragEnter={() => setDragOverColumn(col.id)}
                            onDragLeave={(e) => handleDragLeave(e, col.id)}
                            onDrop={(e) => handleDrop(e, col.id)}
                            className={`rounded-2xl border transition-all duration-150 ${
                                isOver
                                    ? "border-violet-400 dark:border-violet-500 bg-violet-50/40 dark:bg-violet-900/10 ring-2 ring-violet-300 dark:ring-violet-700"
                                    : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
                            }`}
                        >
                            {/* Column header */}
                            <div className="px-4 pt-4 pb-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                                    <span className={`text-xs font-semibold uppercase tracking-wider ${col.color}`}>
                                        {col.label}
                                    </span>
                                </div>
                                <span className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                                    {colItems.length}
                                </span>
                            </div>

                            {/* Cards */}
                            <div className="px-3 pb-3 space-y-2 min-h-[60px]">
                                {colItems.length === 0 && (
                                    <div className={`h-16 rounded-xl border-2 border-dashed flex items-center justify-center transition-colors ${
                                        isOver ? "border-violet-300 dark:border-violet-600" : "border-slate-200 dark:border-slate-700"
                                    }`}>
                                        <span className="text-xs text-slate-300 dark:text-slate-600">Drop here</span>
                                    </div>
                                )}
                                {colItems.map(item => (
                                    <div
                                        key={item.id}
                                        draggable
                                        onDragStart={(e) => {
                                            e.dataTransfer.effectAllowed = "move";
                                            e.dataTransfer.setData("text/plain", String(item.id));
                                            setDraggingId(item.id);
                                        }}
                                        onDragEnd={() => { setDraggingId(null); setDragOverColumn(null); }}
                                        className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-all duration-150 select-none ${
                                            draggingId === item.id ? "opacity-40 scale-95" : ""
                                        }`}
                                    >
                                        <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-3 mb-2 leading-relaxed">
                                            {item.description}
                                        </p>
                                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                                            {item.assigned_to && (
                                                <span className="text-xs font-medium text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 px-2 py-0.5 rounded-full">
                                                    {item.assigned_to}
                                                </span>
                                            )}
                                            {item.priority === "high" && (
                                                <span className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
                                                    High
                                                </span>
                                            )}
                                            {item.due_date && (
                                                <span className="text-xs text-slate-400 dark:text-slate-500">
                                                    Due {new Date(item.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                                </span>
                                            )}
                                        </div>
                                        <Link
                                            href={`/dashboard/meetings/${item.meeting_id}`}
                                            onClick={(e) => e.stopPropagation()}
                                            className="text-xs text-slate-400 dark:text-slate-500 hover:text-violet-500 dark:hover:text-violet-400 transition-colors truncate block"
                                        >
                                            {item.meeting_title}
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Empty state */}
            {items.length === 0 && (
                <div className="mt-8 text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="w-16 h-16 bg-violet-50 dark:bg-violet-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="5" height="18" rx="1"/>
                            <rect x="10" y="3" width="5" height="12" rx="1"/>
                            <rect x="17" y="3" width="4" height="16" rx="1"/>
                        </svg>
                    </div>
                    <h3 className="text-slate-700 dark:text-slate-300 font-semibold mb-1">No items on the board yet</h3>
                    <p className="text-sm text-slate-400 dark:text-slate-500 mb-4">
                        Open a meeting and click <strong>+ Board</strong> next to any action item to add it here.
                    </p>
                    <Link href="/dashboard" className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors">
                        Go to Meetings
                    </Link>
                </div>
            )}

            {/* Toasts */}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
                {toasts.map(t => (
                    <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium pointer-events-auto ${
                        t.type === "error"
                            ? "bg-white dark:bg-slate-800 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"
                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                    }`}>
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.type === "error" ? "bg-red-500" : "bg-emerald-500"}`} />
                        {t.text}
                    </div>
                ))}
            </div>
        </div>
    );
}
