'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface CourseChatBotProps {
  courseContent?: string;
  courseTitle?: string;
}

export default function CourseChatBot({ courseContent = '', courseTitle = '' }: CourseChatBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Hello! I'm your AI tutor for ${courseTitle || 'this course'}. Ask me anything about the course content!`,
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check if user is logged in
  const checkUserLogin = () => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token');
      setIsUserLoggedIn(!!token);
      return !!token;
    }
    return false;
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check if user is logged in on mount
  useEffect(() => {
    checkUserLogin();
  }, []);

  const decodeTokenPayload = (token: string) => {
    try {
      const [, payload] = token.split('.');
      const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
      const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded);
    } catch {
      return {};
    }
  };

  const buildRequestHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token');
      const tenantId = localStorage.getItem('tenant_id');

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      if (tenantId) {
        headers['x-tenant-id'] = tenantId;
      } else if (token) {
        const payload = decodeTokenPayload(token);
        if (payload?.tenant_id) {
          headers['x-tenant-id'] = String(payload.tenant_id);
          localStorage.setItem('tenant_id', String(payload.tenant_id));
        }
      }
    }

    return headers;
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) {
      return;
    }

    // Check if user is logged in
    if (!checkUserLogin()) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Please login to use the AI assistant.',
        },
      ]);
      setInputValue('');
      return;
    }

    const userMessageContent = inputValue.trim();
    const userMessage: ChatMessage = {
      role: 'user',
      content: userMessageContent,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: buildRequestHeaders(),
        body: JSON.stringify({
          question: userMessageContent,
          course_content: courseContent,
          course_title: courseTitle,
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const detail = responseData?.detail ?? 'Sorry, I encountered an error. Please try again.';
        throw new Error(detail);
      }

      const aiMessage: ChatMessage = {
        role: 'assistant',
        content: responseData.response,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      let errorMessage = 'Sorry, I encountered an error. Please try again.';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          errorMessage = 'Please login to use the AI assistant.';
          setIsUserLoggedIn(false);
        } else {
          const detail = error.response?.data?.detail;
          if (typeof detail === 'string') {
            errorMessage = detail;
          }
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: errorMessage,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: `Hello! I'm your AI tutor for ${courseTitle || 'this course'}. Ask me anything about the course content!`,
      },
    ]);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Floating Chat Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-sky-600 shadow-lg hover:bg-sky-700 hover:shadow-xl transition-all duration-300 flex items-center justify-center text-white animate-pulse"
        aria-label="Open course AI assistant"
        title="Chat with AI Course Assistant"
      >
        <svg
          className="w-6 h-6"
          fill="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      </button>

      {/* Chat Modal */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-40 w-96 h-[32rem] bg-white rounded-lg shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="bg-sky-600 text-white px-4 py-3 flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-sm">🤖 AI Course Assistant</h3>
              <p className="text-xs opacity-90">{courseTitle || 'Course Chat'}</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:bg-sky-700 rounded-full p-1 transition-colors"
              aria-label="Close chatbot"
            >
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                    message.role === 'user'
                      ? 'bg-sky-600 text-white rounded-br-sm'
                      : 'bg-white text-slate-900 rounded-bl-sm shadow-sm border border-slate-200'
                  }`}
                >
                  <p className="break-words leading-relaxed">{message.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white text-slate-900 px-3 py-2 rounded-lg rounded-bl-sm shadow-sm border border-slate-200">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-sky-400 rounded-full animate-bounce delay-100" />
                    <div className="w-2 h-2 bg-sky-400 rounded-full animate-bounce delay-200" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-slate-200 p-3 bg-white">
            {!isUserLoggedIn && (
              <div className="bg-amber-50 border border-amber-200 rounded p-2 mb-2">
                <p className="text-xs text-amber-800">
                  Please login to use the AI assistant.
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={isUserLoggedIn ? 'Ask about the course...' : 'Login to chat'}
                disabled={isLoading || !isUserLoggedIn}
                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400 transition-colors"
              />
              <button
                onClick={handleSendMessage}
                disabled={isLoading || !inputValue.trim() || !isUserLoggedIn}
                className="px-3 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                aria-label="Send message"
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5.951-1.429 5.951 1.429a1 1 0 001.169-1.409l-7-14z" />
                </svg>
              </button>
            </div>
            <button
              onClick={handleClearChat}
              disabled={isLoading}
              className="w-full mt-2 px-3 py-1 text-xs bg-slate-100 text-slate-700 rounded hover:bg-slate-200 disabled:opacity-50 transition-colors"
            >
              Clear Chat
            </button>
          </div>
        </div>
      )}
    </>
  );
}