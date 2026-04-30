interface Practice {
  task: string;
  solution: string;
}

interface ExcelPracticeSectionProps {
  practice: Practice;
}

export function ExcelPracticeSection({ practice }: ExcelPracticeSectionProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8">
      <h2 className="text-2xl font-semibold text-gray-900 mb-6">Practice Exercise</h2>

      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3">Task:</h3>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <p className="text-gray-700">{practice.task}</p>
        </div>
      </div>

      <details className="bg-blue-50 border border-blue-200 rounded-lg">
        <summary className="cursor-pointer px-6 py-4 font-medium text-blue-900 hover:bg-blue-100 transition-colors rounded-lg">
          Show Solution
        </summary>
        <div className="px-6 pb-4">
          <div className="bg-white border border-slate-200 rounded p-4 mt-2">
            <p className="text-gray-700 font-mono text-sm">
              {practice.solution}
            </p>
          </div>
        </div>
      </details>
    </div>
  );
}