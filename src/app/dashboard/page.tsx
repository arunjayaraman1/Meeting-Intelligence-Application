"use client";
import { useEffect, useState } from "react";
interface User {
    id: number;
    email: string;
    name: string;
}
interface Meeting {
    id: number;
    title: string;
    start_time: string;
    status: string;
    summary: string;
}
export default function Dashboard() {
    const [user, setUser] = useState<User | null>(null);
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        fetch("/api/dashboard")
            .then(res => res.json() as Promise<{ user: User; meetings: Meeting[] }>)
            .then((data) => {
                setUser(data.user);
                setMeetings(data.meetings);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load dashboard:", err);
                setLoading(false);
            });
    }, []);
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-xl text-gray-600">Loading dashboard...</div>
            </div>
        );
    }
    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-4">Not Connected</h2>
                    <p className="text-gray-600 mb-6">Please connect your Microsoft account to view your meetings.</p>
                    <a
                        href="/api/auth/microsoft"
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Connect with Microsoft
                    </a>
                </div>
            </div>
        );
    }
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-6xl mx-auto p-8">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                    <div className="bg-white px-4 py-2 rounded-lg shadow">
                        <span className="text-gray-600">Connected as:</span>
                        <span className="ml-2 font-medium">{user.name}</span>
                    </div>
                </div>
                {/* Meetings Section */}
                <div className="bg-white rounded-xl shadow-md p-6">
                    <h2 className="text-xl font-semibold mb-4">Your Meetings</h2>
                    
                    {meetings.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="text-6xl mb-4">📅</div>
                            <h3 className="text-xl font-medium text-gray-700 mb-2">No meetings yet</h3>
                            <p className="text-gray-500">
                                Connect your Teams account and start having meetings. We'll automatically process them.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {meetings.map((meeting) => (
                                <div
                                    key={meeting.id}
                                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-semibold text-lg">{meeting.title}</h3>
                                            <p className="text-sm text-gray-500 mt-1">
                                                {new Date(meeting.start_time).toLocaleString()}
                                            </p>
                                        </div>
                                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                                            meeting.status === 'completed' ? 'bg-green-100 text-green-800' :
                                            meeting.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                                            meeting.status === 'failed' ? 'bg-red-100 text-red-800' :
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                            {meeting.status}
                                        </span>
                                    </div>
                                    {meeting.summary && (
                                        <p className="mt-3 text-gray-600 text-sm line-clamp-2">
                                            {meeting.summary}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}