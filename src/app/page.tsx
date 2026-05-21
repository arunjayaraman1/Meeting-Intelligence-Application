import Link from "next/link";
export default function Home() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
            {/* Hero Section */}
            <div className="max-w-6xl mx-auto px-6 py-20">
                <div className="text-center mb-16">
                    <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
                        AI Meeting Intelligence
                    </h1>
                    <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto mb-8">
                        Automatically capture, transcribe, and analyze your Microsoft Teams meetings.
                        Get AI-powered summaries, action items, and semantic search — all running at the edge.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link
                            href="/api/auth/microsoft"
                            className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg font-medium shadow-lg hover:shadow-xl"
                        >
                            Connect with Microsoft
                        </Link>
                        <Link
                            href="/dashboard"
                            className="px-8 py-4 bg-white text-blue-600 border-2 border-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-lg font-medium"
                        >
                            View Dashboard
                        </Link>
                    </div>
                </div>
                {/* Features Section */}
                <div className="grid md:grid-cols-3 gap-8 mt-20">
                    <div className="bg-white p-8 rounded-xl shadow-md">
                        <div className="text-4xl mb-4">🎙️</div>
                        <h3 className="text-xl font-semibold mb-3">Automatic Transcription</h3>
                        <p className="text-gray-600">
                            AI transcribes your meetings in real-time with speaker identification and timestamps.
                        </p>
                    </div>
                    <div className="bg-white p-8 rounded-xl shadow-md">
                        <div className="text-4xl mb-4">📝</div>
                        <h3 className="text-xl font-semibold mb-3">Smart Summaries</h3>
                        <p className="text-gray-600">
                            Get concise meeting summaries and automatically extracted action items.
                        </p>
                    </div>
                    <div className="bg-white p-8 rounded-xl shadow-md">
                        <div className="text-4xl mb-4">🔍</div>
                        <h3 className="text-xl font-semibold mb-3">Semantic Search</h3>
                        <p className="text-gray-600">
                            Search across all your meetings using natural language. Find decisions, topics, and more.
                        </p>
                    </div>
                </div>
                {/* How It Works Section */}
                <div className="mt-20 text-center">
                    <h2 className="text-3xl font-bold text-gray-900 mb-12">How It Works</h2>
                    <div className="grid md:grid-cols-4 gap-8">
                        <div className="bg-white p-6 rounded-lg shadow">
                            <div className="text-3xl font-bold text-blue-600 mb-2">1</div>
                            <p className="text-gray-700">Connect your Microsoft account</p>
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow">
                            <div className="text-3xl font-bold text-blue-600 mb-2">2</div>
                            <p className="text-gray-700">Have your Teams meetings as usual</p>
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow">
                            <div className="text-3xl font-bold text-blue-600 mb-2">3</div>
                            <p className="text-gray-700">AI processes recordings automatically</p>
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow">
                            <div className="text-3xl font-bold text-blue-600 mb-2">4</div>
                            <p className="text-gray-700">View summaries, action items, and search</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}