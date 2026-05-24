import Link from "next/link";

export default function Home() {
    return (
        <div className="min-h-screen bg-white dark:bg-slate-950">
            {/* Navbar */}
            <nav className="fixed top-0 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-700/60 z-50">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center shadow-md shadow-violet-500/30">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M8 2L14 5.5V10.5L8 14L2 10.5V5.5L8 2Z" fill="white" fillOpacity="0.9"/>
                                <circle cx="8" cy="8" r="2.5" fill="white"/>
                            </svg>
                        </div>
                        <span className="font-bold text-slate-900 dark:text-slate-100 text-lg">MeetMind</span>
                    </div>
                    <Link
                        href="/api/auth/microsoft"
                        className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors text-sm font-medium shadow-sm shadow-violet-500/30"
                    >
                        Sign in with Microsoft
                    </Link>
                </div>
            </nav>

            {/* Hero */}
            <section className="pt-32 pb-20 bg-gradient-to-b from-violet-50 via-white to-white dark:from-slate-900 dark:via-slate-950 dark:to-slate-950">
                <div className="max-w-6xl mx-auto px-6 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 rounded-full text-sm font-medium mb-6">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                            <path d="M7 1l1.5 3 3.5.5-2.5 2.5.5 3.5L7 9 4 10.5l.5-3.5L2 4.5 5.5 4z"/>
                        </svg>
                        Powered by Cloudflare Workers AI
                    </div>
                    <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-slate-900 dark:text-slate-50 mb-6 leading-tight">
                        Never miss a meeting<br />
                        <span className="text-violet-600 dark:text-violet-400">decision again</span>
                    </h1>
                    <p className="text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto mb-10">
                        MeetMind automatically transcribes, summarizes, and searches your Microsoft Teams meetings — so you can focus on the work, not the notes.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link
                            href="/api/auth/microsoft"
                            className="inline-flex items-center gap-2 px-8 py-4 bg-violet-600 text-white rounded-xl font-semibold shadow-lg hover:bg-violet-700 hover:shadow-violet-200 hover:shadow-xl transition-all text-base"
                        >
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                                <rect x="1" y="1" width="8.5" height="8.5" fill="#f25022"/>
                                <rect x="10.5" y="1" width="8.5" height="8.5" fill="#7fba00"/>
                                <rect x="1" y="10.5" width="8.5" height="8.5" fill="#00a4ef"/>
                                <rect x="10.5" y="10.5" width="8.5" height="8.5" fill="#ffb900"/>
                            </svg>
                            Connect with Microsoft
                        </Link>
                        <Link
                            href="/dashboard"
                            className="px-8 py-4 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-base"
                        >
                            View Dashboard
                        </Link>
                    </div>

                    {/* Product mockup */}
                    <div className="mt-16 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl shadow-slate-200 dark:shadow-slate-950 overflow-hidden bg-white dark:bg-slate-800 text-left">
                        <div className="bg-slate-900 px-4 py-3 flex items-center gap-2">
                            <div className="flex gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-red-400"/>
                                <div className="w-3 h-3 rounded-full bg-amber-400"/>
                                <div className="w-3 h-3 rounded-full bg-emerald-400"/>
                            </div>
                            <div className="flex-1 mx-4 bg-slate-800 rounded px-3 py-1 text-xs text-slate-400">
                                meetmind.app/dashboard
                            </div>
                        </div>
                        <div className="flex h-64">
                            <div className="w-48 bg-slate-900 p-4 flex flex-col gap-1">
                                <div className="text-white text-xs font-bold px-2 py-1.5 mb-2">MeetMind</div>
                                <div className="bg-violet-600 text-white text-xs px-3 py-2 rounded-lg font-medium">Meetings</div>
                                <div className="text-slate-400 text-xs px-3 py-2 rounded-lg">Analytics</div>
                            </div>
                            <div className="flex-1 p-5 bg-slate-50">
                                <div className="flex justify-between items-center mb-4">
                                    <div>
                                        <div className="text-sm font-semibold text-slate-900">Meetings</div>
                                        <div className="text-xs text-slate-400">4 meetings · Last synced just now</div>
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="bg-violet-600 text-white text-xs px-3 py-1.5 rounded-lg">Sync</div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    {[
                                        { title: "Q2 Planning — Product Review", status: "processed", statusColor: "text-emerald-700 bg-emerald-50" },
                                        { title: "API Architecture Discussion", status: "processed", statusColor: "text-emerald-700 bg-emerald-50" },
                                        { title: "Weekly Standup", status: "no_transcript", statusColor: "text-slate-500 bg-slate-100" },
                                    ].map((m, i) => (
                                        <div key={i} className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between">
                                            <div>
                                                <div className="text-xs font-medium text-slate-800">{m.title}</div>
                                                <div className="text-xs text-slate-400 mt-0.5">May 22, 2026</div>
                                            </div>
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${m.statusColor}`}>{m.status}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className="py-20 bg-white dark:bg-slate-950">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-50 mb-4">Everything you need to stay on top of meetings</h2>
                        <p className="text-slate-500 dark:text-slate-400 max-w-xl mx-auto">Built on Cloudflare&apos;s edge network for blazing-fast performance anywhere in the world.</p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            {
                                icon: <path d="M12 2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h4zm-2 12v2M8 18h8M7 8H4a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h2" />,
                                title: "Auto Transcription",
                                desc: "Pulls transcripts directly from Microsoft Teams via Graph API. No bots, no extra recording setup."
                            },
                            {
                                icon: <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 0 2-2h2a2 2 0 0 0 2 2m-6 7 2 2 4-4" />,
                                title: "AI Summaries",
                                desc: "Llama 3.1 distills every meeting into a concise summary, key decisions, and actionable tasks."
                            },
                            {
                                icon: <><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></>,
                                title: "Smart Search",
                                desc: "Ask natural-language questions across all your meetings. Get instant answers, not just search results."
                            },
                            {
                                icon: <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6.002 6.002 0 0 0-4-5.659V5a2 2 0 1 0-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9" />,
                                title: "Real-time Webhooks",
                                desc: "Subscribe to Microsoft Graph webhooks for automatic meeting processing the moment a meeting ends."
                            },
                            {
                                icon: <path d="M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2zm0 0V9a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10m12 0v-3a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v3m0 0h6" />,
                                title: "Analytics",
                                desc: "Track meeting trends, action item completion, top contributors, and more with visual dashboards."
                            },
                            {
                                icon: <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
                                title: "Privacy First",
                                desc: "Your data stays in your Cloudflare account. No third-party storage, no data sharing."
                            },
                        ].map((feature, i) => (
                            <div key={i} className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-6 shadow-sm hover:shadow-md dark:hover:bg-slate-800 transition-all">
                                <div className="w-10 h-10 bg-violet-100 dark:bg-violet-900/40 rounded-lg flex items-center justify-center mb-4">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        {feature.icon}
                                    </svg>
                                </div>
                                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">{feature.title}</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How it works */}
            <section className="py-20 bg-slate-50 dark:bg-slate-900">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-50 mb-4">Up and running in minutes</h2>
                    </div>
                    <div className="grid md:grid-cols-4 gap-6">
                        {[
                            { step: "1", title: "Connect", desc: "Sign in with your Microsoft account — personal or work." },
                            { step: "2", title: "Meet", desc: "Have your Teams meetings as usual with transcription enabled." },
                            { step: "3", title: "Process", desc: "MeetMind syncs and runs AI on every meeting automatically." },
                            { step: "4", title: "Insights", desc: "View summaries, decisions, and action items instantly." },
                        ].map((s) => (
                            <div key={s.step} className="text-center">
                                <div className="w-12 h-12 bg-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-500/30">
                                    <span className="text-white font-bold text-lg">{s.step}</span>
                                </div>
                                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">{s.title}</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{s.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-20 bg-slate-900">
                <div className="max-w-2xl mx-auto px-6 text-center">
                    <h2 className="text-3xl font-bold text-white mb-4">Ready to reclaim your meeting time?</h2>
                    <p className="text-slate-400 mb-8">Connect your Microsoft account and start getting AI meeting intelligence for free.</p>
                    <Link
                        href="/api/auth/microsoft"
                        className="inline-flex items-center gap-2 px-8 py-4 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-500 transition-colors shadow-lg"
                    >
                        Get started free
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-slate-900 border-t border-slate-800 py-8">
                <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-violet-600 rounded flex items-center justify-center">
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                                <path d="M8 2L14 5.5V10.5L8 14L2 10.5V5.5L8 2Z" fill="white" fillOpacity="0.9"/>
                            </svg>
                        </div>
                        <span className="text-slate-400 text-sm font-medium">MeetMind</span>
                    </div>
                    <p className="text-slate-600 text-sm">Built on Cloudflare Workers</p>
                </div>
            </footer>
        </div>
    );
}
