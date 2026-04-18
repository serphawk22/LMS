import Link from 'next/link';

interface Topic {
  id: string;
  title: string;
  description: string;
}

interface ExcelTopicCardProps {
  topic: Topic;
}

export function ExcelTopicCard({ topic }: ExcelTopicCardProps) {
  return (
    <Link href="/courses" className="block group">
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 hover:bg-blue-50 hover:border-blue-200 transition-all duration-200 group-hover:shadow-md">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-slate-900 group-hover:text-blue-900 transition-colors mb-2">
              {topic.title}
            </h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              {topic.description}
            </p>
            <div className="mt-4 text-blue-600 font-medium text-sm group-hover:text-blue-700 transition-colors">
              Start Learning →
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}