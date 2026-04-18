'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import api from '@/lib/api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Hello! I am your AI learning assistant. Ask me anything about your course.',
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isChatbotAvailable, setIsChatbotAvailable] = useState(true);
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check if user is logged in (has access token)
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
    const isLoggedIn = checkUserLogin();
    
    if (isLoggedIn) {
      // Check if chatbot service is available
      const checkChatbotHealth = async () => {
        try {
          await api.get('/chatbot/health');
          setIsChatbotAvailable(true);
        } catch (error) {
          console.warn('Chatbot service not available:', error);
          setIsChatbotAvailable(false);
        }
      };
      
      checkChatbotHealth();
    }
  }, []);

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

    if (!isChatbotAvailable) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'The AI assistant is currently unavailable. Please try again later.',
        },
      ]);
      setInputValue('');
      return;
    }

    // Save the message before clearing input
    const userMessageContent = inputValue.trim();

    // Add user message to chat
    const userMessage: ChatMessage = {
      role: 'user',
      content: userMessageContent,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // API call with token handled by interceptor
      const response = await api.post('/chatbot/chat', {
        message: userMessageContent,
        conversation_history: messages,
      });

      const aiMessage: ChatMessage = {
        role: 'assistant',
        content: response.data.response,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      let errorMessage = 'Sorry, I encountered an error. Please try again.';

      if (axios.isAxiosError(error)) {
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
        content: 'Hello! I am your AI learning assistant. Ask me anything about your course.',
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
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-sky-600 shadow-lg hover:bg-sky-700 transition-all duration-200 flex items-center justify-center text-white"
        aria-label="Open chatbot"
        title="Chat with AI Assistant"
      >
        <svg
          className="w-6 h-6"
          fill="currentColor"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0L10 9.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Chat Modal */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-40 w-96 h-96 bg-white rounded-lg shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-sky-600 text-white px-4 py-4 flex justify-between items-center">
            <h3 className="font-semibold">AI Learning Assistant</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:bg-sky-700 rounded-full p-1 transition"
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
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-xs px-4 py-2 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-sky-600 text-white rounded-br-none'
                      : 'bg-slate-100 text-slate-900 rounded-bl-none'
                  }`}
                >
                  <p className="text-sm break-words">{message.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 text-slate-900 px-4 py-2 rounded-lg rounded-bl-none">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100" />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-slate-200 p-4 space-y-2">
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
                placeholder={isUserLoggedIn ? 'Ask something...' : 'Login to chat'}
                disabled={isLoading || !isUserLoggedIn}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-slate-50 disabled:text-slate-400"
              />
              <button
                onClick={handleSendMessage}
                disabled={isLoading || !inputValue.trim() || !isUserLoggedIn}
                className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
                aria-label="Send message"
              >
                <svg
                  className="w-5 h-5"
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
              className="w-full px-3 py-1 text-sm bg-slate-100 text-slate-700 rounded hover:bg-slate-200 disabled:opacity-50 transition"
            >
              Clear Chat
            </button>
          </div>
        </div>
      )}
    </>
  );
}
