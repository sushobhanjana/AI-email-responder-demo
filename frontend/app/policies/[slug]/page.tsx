import { notFound } from 'next/navigation';
import Link from 'next/link';

import ReactMarkdown from 'react-markdown';

async function getPolicy(slug: string) {
    try {
        const res = await fetch(`http://localhost:1337/api/policies?filters[slug][$eq]=${slug}`, { cache: 'no-store' });
        const json = await res.json();
        return json.data && json.data.length > 0 ? json.data[0] : null;
    } catch (e) {
        return null;
    }
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const policy = await getPolicy(slug);

    if (!policy) {
        notFound();
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8 font-sans">
            <div className="max-w-4xl mx-auto">
                <Link href="/policies" className="inline-flex items-center text-gray-500 hover:text-blue-600 mb-8 transition-colors">
                    &larr; Back to Policies
                </Link>

                <article className="bg-white p-10 rounded-2xl shadow-lg border border-gray-100">
                    <h1 className="text-4xl font-extrabold mb-6 text-gray-900 border-b pb-4">
                        {policy.title}
                    </h1>

                    <div className="prose prose-blue prose-lg max-w-none text-gray-700 leading-relaxed">
                        <ReactMarkdown>{policy.content}</ReactMarkdown>
                    </div>

                    <div className="mt-12 pt-6 border-t text-sm text-gray-400">
                        Policy ID: {policy.slug} • Last Updated: {new Date(policy.updatedAt).toLocaleString()}
                    </div>
                </article>
            </div>
        </div>
    );
}
