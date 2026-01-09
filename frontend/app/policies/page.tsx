import Link from 'next/link';

async function getPolicies() {
    try {
        const res = await fetch('http://localhost:1337/api/policies', { cache: 'no-store' });
        if (!res.ok) return [];
        const json = await res.json();
        return json.data || [];
    } catch (e) {
        console.error("Fetch error:", e);
        return [];
    }
}

export default async function PoliciesPage() {
    const policies = await getPolicies();

    return (
        <div className="min-h-screen bg-gray-50 p-8 font-sans">
            <div className="max-w-4xl mx-auto">
                <header className="mb-12 text-center">
                    <h1 className="text-5xl font-extrabold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                        Company Policies
                    </h1>
                    <p className="text-xl text-gray-600">
                        Access all updated governance documents.
                    </p>
                </header>

                <div className="grid gap-6">
                    {policies.map((policy: any) => (
                        <Link
                            key={policy.documentId || policy.id}
                            href={`/policies/${policy.slug}`}
                            className="block group relative p-8 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                        >
                            <div className="flex justify-between items-center">
                                <h2 className="text-2xl font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                                    {policy.title}
                                </h2>
                                <span className="opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all font-semibold text-blue-500">
                                    Read &rarr;
                                </span>
                            </div>
                            <p className="mt-2 text-gray-400 text-sm">
                                Last Updated: {new Date(policy.updatedAt).toLocaleDateString()}
                            </p>
                        </Link>
                    ))}
                    {policies.length === 0 && (
                        <div className="text-center p-12 bg-white rounded-xl border border-dashed border-gray-300">
                            <p className="text-gray-500 text-lg">No policies found. Migration might be in progress.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
