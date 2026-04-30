'use client';

import { useState } from 'react';

type Mode = 'ask' | 'summarize' | 'quiz';

export function AILearningAssistant() {
  const [content, setContent] = useState('');
  const [mode, setMode] = useState<Mode>('ask');
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!content.trim()) {
      setResponse('Please paste some lesson content first.');
      return;
    }

    if (mode === 'ask' && !question.trim()) {
      setResponse('Please enter a question.');
      return;
    }

    setLoading(true);
    setResponse('');

    try {
      let prompt = '';
      if (mode === 'summarize') {
        prompt = `Summarize the following content in simple bullet points for a beginner: ${content}`;
      } else if (mode === 'quiz') {
        prompt = `Generate 5 quiz questions with answers based on the following content: ${content}`;
      } else if (mode === 'ask') {
        prompt = `Answer the question based only on the following content.
Content: ${content}
Question: ${question}`;
      }

      // Assuming OpenAI API integration
      const apiResponse = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      if (!apiResponse.ok) {
        throw new Error('Failed to get response from AI');
      }

      const data = await apiResponse.json();
      setResponse(data.response);
    } catch (error) {
      setResponse('Sorry, I couldn\'t process your request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatResponse = (text: string) => {
    if (mode === 'summarize') {
      return text.split('\n').map((line, idx) => (
        <li key={idx} className="text-sm text-slate-700">{line.replace(/^- /, '')}</li>
      ));
    } else if (mode === 'quiz') {
      return text.split('\n').map((line, idx) => (
        <div key={idx} className="text-sm text-slate-700 mb-2">{line}</div>
      ));
    } else {
      return <p className="text-sm text-slate-700">{text}</p>;
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">🤖 AI Learning Assistant</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Paste lesson content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
            placeholder="Paste the lesson content here..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Choose an action</label>
          <div className="flex gap-4">
            {[
              { id: 'ask' as Mode, label: 'Ask Question' },
              { id: 'summarize' as Mode, label: 'Summarize' },
              { id: 'quiz' as Mode, label: 'Generate Quiz' },
            ].map((option) => (
              <label key={option.id} className="flex items-center">
                <input
                  type="radio"
                  name="mode"
                  value={option.id}
                  checked={mode === option.id}
                  onChange={(e) => setMode(e.target.value as Mode)}
                  className="mr-2"
                />
                <span className="text-sm text-slate-700">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {mode === 'ask' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Your question</label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
              placeholder="Ask a question about the content..."
            />
          </div>
        )}

        <button
          onClick={handleSend}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Sending...' : 'Send'}
        </button>

        {response && (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h4 className="text-sm font-semibold text-slate-900 mb-2">Response</h4>
            {mode === 'summarize' ? (
              <ul className="list-disc list-inside space-y-1">{formatResponse(response)}</ul>
            ) : mode === 'quiz' ? (
              <div>{formatResponse(response)}</div>
            ) : (
              formatResponse(response)
            )}
          </div>
        )}
      </div>
    </div>
  );
}
