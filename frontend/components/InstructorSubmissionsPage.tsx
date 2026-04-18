import { useCallback, useEffect, useState } from 'react';
import { fetchAssignments } from '@/services/assignments';
import { fetchAssignmentSubmissions, gradeAssignmentSubmission } from '@/services/assignments';
import type { Assignment, AssignmentSubmission, AssignmentGradePayload } from '@/types/assignment';

export default function InstructorSubmissionsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [grading, setGrading] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'graded'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAssignments();
      setAssignments(data);
    } catch (error) {
      console.error('Failed to load assignments:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSubmissions = useCallback(async (assignmentId: number) => {
    setLoadingSubmissions(true);
    try {
      const data = await fetchAssignmentSubmissions(assignmentId);
      setSubmissions(data);
    } catch (error) {
      console.error('Failed to load submissions:', error);
      setSubmissions([]);
    } finally {
      setLoadingSubmissions(false);
    }
  }, []);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const handleAssignmentClick = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    loadSubmissions(assignment.id);
  };

  const handleGrade = async (submissionId: number, grade: number, feedback: string) => {
    setGrading(submissionId);
    try {
      const payload: AssignmentGradePayload = {
        grade,
        feedback,
        status: 'graded',
      };
      const updatedSubmission = await gradeAssignmentSubmission(submissionId, payload);
      setSubmissions(prev =>
        prev.map(sub => sub.id === submissionId ? updatedSubmission : sub)
      );
    } catch (error) {
      console.error('Failed to grade submission:', error);
      alert('Failed to submit grade. Please try again.');
    } finally {
      setGrading(null);
    }
  };

  const filteredSubmissions = submissions.filter(sub => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'pending' && sub.status === 'submitted') ||
      (filter === 'graded' && sub.status === 'graded');

    const matchesSearch = !searchQuery ||
      (sub.student_name?.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesFilter && matchesSearch;
  });

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="rounded-2xl bg-white p-8 text-center">
          <div className="text-slate-500">Loading assignments...</div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="rounded-2xl bg-white p-8">
        <h2 className="text-xl font-semibold mb-4">Assignment Submissions & Grading</h2>

        {!selectedAssignment ? (
          // Assignments List
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Select an Assignment</h3>
            {assignments.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                No assignments found. Create some assignments first.
              </div>
            ) : (
              <div className="grid gap-4">
                {assignments.map(assignment => (
                  <div
                    key={assignment.id}
                    className="border rounded-lg p-4 hover:bg-slate-50 cursor-pointer"
                    onClick={() => handleAssignmentClick(assignment)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">{assignment.title}</h4>
                        <p className="text-sm text-slate-600">{assignment.course_name}</p>
                        <p className="text-sm text-slate-500">
                          Due: {assignment.due_date ? new Date(assignment.due_date).toLocaleDateString() : 'No due date'}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-slate-600">
                          {assignment.submissions_count} submission{assignment.submissions_count !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          // Submissions View
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <button
                  onClick={() => setSelectedAssignment(null)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  ← Back to assignments
                </button>
                <h3 className="text-lg font-medium mt-2">{selectedAssignment.title}</h3>
                <p className="text-sm text-slate-600">{selectedAssignment.course_name}</p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-4 items-center">
              <div>
                <label className="block text-sm font-medium mb-1">Filter</label>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as 'all' | 'pending' | 'graded')}
                  className="border rounded px-3 py-1 text-sm"
                >
                  <option value="all">All Submissions</option>
                  <option value="pending">Pending</option>
                  <option value="graded">Graded</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Search</label>
                <input
                  type="text"
                  placeholder="Search by student name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border rounded px-3 py-1 text-sm"
                />
              </div>
            </div>

            {loadingSubmissions ? (
              <div className="text-center py-8 text-slate-500">Loading submissions...</div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                {submissions.length === 0 ? 'No submissions yet.' : 'No submissions match your filters.'}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredSubmissions.map(submission => (
                  <SubmissionCard
                    key={submission.id}
                    submission={submission}
                    onGrade={handleGrade}
                    grading={grading === submission.id}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function SubmissionCard({
  submission,
  onGrade,
  grading
}: {
  submission: AssignmentSubmission;
  onGrade: (submissionId: number, grade: number, feedback: string) => void;
  grading: boolean;
}) {
  const [grade, setGrade] = useState(submission.grade?.toString() || '');
  const [feedback, setFeedback] = useState(submission.feedback || '');
  const [showGrading, setShowGrading] = useState(false);

  const handleSubmitGrade = () => {
    const gradeNum = parseFloat(grade);
    if (isNaN(gradeNum)) {
      alert('Please enter a valid grade.');
      return;
    }
    onGrade(submission.id, gradeNum, feedback);
    setShowGrading(false);
  };

  return (
    <div className={`border rounded-lg p-4 ${submission.status === 'graded' ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h4 className="font-medium">{submission.student_name || 'Unknown Student'}</h4>
          <p className="text-sm text-slate-600">
            Submitted: {new Date(submission.submitted_at).toLocaleString()}
            {submission.late && <span className="text-red-600 ml-2">(Late)</span>}
          </p>
          <p className="text-sm text-slate-600">Status: {submission.status}</p>
        </div>
        <div className="flex gap-2">
          {submission.content && (
            <a
              href={submission.content}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
            >
              Open Submission
            </a>
          )}
          {submission.status !== 'graded' && (
            <button
              onClick={() => setShowGrading(!showGrading)}
              className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
            >
              {showGrading ? 'Cancel' : 'Grade'}
            </button>
          )}
        </div>
      </div>

      {submission.status === 'graded' && (
        <div className="mb-4 p-3 bg-green-50 rounded">
          <p className="font-medium">Grade: {submission.grade}</p>
          {submission.feedback && (
            <p className="text-sm mt-1">Feedback: {submission.feedback}</p>
          )}
          {submission.graded_at && (
            <p className="text-xs text-slate-500 mt-1">
              Graded on: {new Date(submission.graded_at).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {showGrading && (
        <div className="border-t pt-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Grade</label>
              <input
                type="number"
                step="0.1"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="e.g., 8.5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Feedback</label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="w-full border rounded px-3 py-2 h-20"
                placeholder="Provide feedback..."
              />
            </div>
          </div>
          <button
            onClick={handleSubmitGrade}
            disabled={grading}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
          >
            {grading ? 'Submitting...' : 'Submit Grade'}
          </button>
        </div>
      )}
    </div>
  );
}