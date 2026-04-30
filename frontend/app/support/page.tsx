'use client';

import React, { useState, useEffect } from 'react';
import * as supportService from '@/services/support';

type SupportCategory = 'Learning Support' | 'Technical Issues' | 'Assignments & Marks';

type Ticket = {
  id: number;
  title: string;
  category: SupportCategory;
  status: string;
  created_at: string;
};

const SupportPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<SupportCategory>('Learning Support');
  const [searchQuery, setSearchQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [showHelpful, setShowHelpful] = useState(false);
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [ticketName, setTicketName] = useState('');
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');
  const [ticketFile, setTicketFile] = useState<File | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState('Help');
  const [isLoading, setIsLoading] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [showFeedbackSuccess, setShowFeedbackSuccess] = useState(false);

  useEffect(() => {
    if (activeTab === 'My Tickets') {
      fetchTickets();
    }
  }, [activeTab]);

  // Array of positive feedback messages
  const positiveMessages = [
    '😊 Glad we could help!',
    '✨ Happy to assist you!',
    '🎉 Great! Let us know if you need anything else.',
    '👍 Awesome! Your issue seems resolved.',
    '🙌 Thanks for using our support system!'
  ];

  // Get a random positive message
  const getRandomPositiveMessage = () => {
    const randomIndex = Math.floor(Math.random() * positiveMessages.length);
    return positiveMessages[randomIndex];
  };

  // Handle "Yes" feedback click
  const handleYesClick = async () => {
    const message = getRandomPositiveMessage();
    setSuccessMessage(message);
    setShowFeedbackSuccess(true);
    setHelpful(true);

    // Track feedback (optional - for analytics)
    try {
      await supportService.submitFeedback({
        query: searchQuery,
        helpful: true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.log('Feedback tracked locally');
    }
  };

  const fetchTickets = async () => {
    try {
      const tickets = await supportService.getTickets();
      setTickets(tickets);
    } catch (error) {
      console.error(error);
    }
  };

  const categories: SupportCategory[] = [
    'Learning Support',
    'Technical Issues',
    'Assignments & Marks'
  ];

  const quickOptions: Record<SupportCategory, string[]> = {
    'Learning Support': ['Mentor Support', 'Doubt Session', 'Notes'],
    'Technical Issues': ['Login Issue', 'Video Not Playing', 'Page Not Loading'],
    'Assignments & Marks': ['Assignment Upload Issue', 'Marks Not Updated', 'Submission Error']
  };

  const submitQuery = async (query: string) => {
    setIsLoading(true);
    try {
      const data = await supportService.getAIHelp(query);
      console.log('API Response:', data);
      setAiResponse(data.answer);
      setShowHelpful(true);
      setHelpful(null);
    } catch (error) {
      console.error(error);
      setAiResponse("Unable to fetch response. Please raise a ticket.");
      setShowHelpful(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      await submitQuery(searchQuery);
    }
  };

  const handleRaiseTicket = async () => {
    const formData = new FormData();
    formData.append('student_name', ticketName);
    formData.append('category', selectedCategory);
    formData.append('title', ticketTitle);
    formData.append('description', ticketDescription);
    if (ticketFile) {
      formData.append('file', ticketFile);
    }
    try {
      const data = await supportService.raiseTicket(formData);
      if (data.ticket_id) {
        setShowSuccess(true);
        setShowForm(false);
        // Add to tickets
        setTickets(prev => [...prev, {
          id: data.ticket_id,
          title: ticketTitle,
          category: selectedCategory,
          status: 'Pending',
          created_at: new Date().toISOString()
        }]);
        setTicketName('');
        setTicketTitle('');
        setTicketDescription('');
        setTicketFile(null);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const renderContent = () => {
    switch (selectedCategory) {
      case 'Learning Support':
        return (
          <div>
            <h2 className="text-2xl font-bold mb-4">Learning Support</h2>
            <p className="text-gray-700">
              Get help with your learning journey. Here you can find resources, FAQs, and contact information for academic support.
            </p>
            <ul className="mt-4 list-disc list-inside">
              <li>How to access course materials</li>
              <li>Study tips and resources</li>
              <li>Contact your instructor</li>
            </ul>
          </div>
        );
      case 'Technical Issues':
        return (
          <div>
            <h2 className="text-2xl font-bold mb-4">Technical Issues</h2>
            <p className="text-gray-700">
              Experiencing technical problems? Find solutions to common issues and how to get technical assistance.
            </p>
            <ul className="mt-4 list-disc list-inside">
              <li>Login problems</li>
              <li>Video playback issues</li>
              <li>Browser compatibility</li>
            </ul>
          </div>
        );
      case 'Assignments & Marks':
        return (
          <div>
            <h2 className="text-2xl font-bold mb-4">Assignments & Marks</h2>
            <p className="text-gray-700">
              Information about submitting assignments, checking marks, and grading policies.
            </p>
            <ul className="mt-4 list-disc list-inside">
              <li>How to submit assignments</li>
              <li>Viewing your marks</li>
              <li>Appealing grades</li>
            </ul>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen">
      {/* Left Side: Categories */}
      <div className="w-1/3 bg-gray-100 p-6">
        <h1 className="text-xl font-semibold mb-4">Support Categories</h1>
        <ul className="space-y-2">
          {categories.map((category) => (
            <li
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`p-3 rounded cursor-pointer ${
                selectedCategory === category
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category}
            </li>
          ))}
        </ul>
      </div>

      {/* Right Side: Content */}
      <div className="w-2/3 p-6">
        {/* Tabs */}
        <div className="flex mb-4">
          <button
            onClick={() => setActiveTab('Help')}
            className={`px-4 py-2 ${activeTab === 'Help' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            Help
          </button>
          <button
            onClick={() => setActiveTab('My Tickets')}
            className={`px-4 py-2 ml-2 ${activeTab === 'My Tickets' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            My Tickets
          </button>
        </div>

        {activeTab === 'Help' ? (
          <>
            <input
              type="text"
              placeholder="Search your issue..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSubmit}
              className="w-full p-3 rounded bg-gray-100 mb-4"
            />
            <div className="mb-4">
              {quickOptions[selectedCategory].map(option => (
                <div
                  key={option}
                  onClick={async () => {
                    setSearchQuery(option);
                    await submitQuery(option);
                  }}
                  className="bg-white p-4 rounded shadow mb-2 cursor-pointer hover:bg-gray-50"
                >
                  {option}
                </div>
              ))}
            </div>
            {isLoading && (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                <p>Getting help for you...</p>
              </div>
            )}
            {aiResponse && (
              <div className="bg-gray-100 p-4 rounded mb-4">
                <h3>🤖 AI Support</h3>
                <p>{aiResponse}</p>
                <div className="mt-2">
                  {!showFeedbackSuccess ? (
                    <>
                      <p>Was this helpful?</p>
                      <button 
                        onClick={handleYesClick} 
                        className="mr-2 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors"
                      >
                        Yes
                      </button>
                      <button 
                        onClick={() => { setHelpful(false); setShowForm(true); }} 
                        className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors"
                      >
                        No
                      </button>
                    </>
                  ) : (
                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg animate-fadeIn">
                      <div className="flex items-start">
                        <div className="text-green-600 mr-3 text-2xl">✓</div>
                        <div>
                          <p className="text-green-800 font-medium text-lg">{successMessage}</p>
                          <p className="text-green-700 text-sm mt-2">
                            Your feedback helps us improve our support system.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {!aiResponse && !isLoading && (
              <p>How can we help you today?</p>
            )}
            {helpful === false && !showForm && (
              <button onClick={() => setShowForm(true)} className="bg-yellow-500 text-white px-4 py-2 rounded mb-4">Raise Ticket</button>
            )}
            {showForm && (
              <div className="mb-4 p-4 bg-gray-50 rounded">
                <h3 className="text-lg font-semibold mb-2">Raise a Support Ticket</h3>
                <div className="mb-2">
                  <label className="block text-sm font-medium">Name</label>
                  <input type="text" value={ticketName} onChange={(e) => setTicketName(e.target.value)} className="w-full p-2 border rounded" />
                </div>
                <div className="mb-2">
                  <label className="block text-sm font-medium">Category</label>
                  <input type="text" value={selectedCategory} readOnly className="w-full p-2 border rounded" />
                </div>
                <div className="mb-2">
                  <label className="block text-sm font-medium">Issue Title</label>
                  <input type="text" value={ticketTitle} onChange={(e) => setTicketTitle(e.target.value)} className="w-full p-2 border rounded" />
                </div>
                <div className="mb-2">
                  <label className="block text-sm font-medium">Description</label>
                  <textarea value={ticketDescription} onChange={(e) => setTicketDescription(e.target.value)} className="w-full p-2 border rounded" rows={4}></textarea>
                </div>
                <div className="mb-2">
                  <label className="block text-sm font-medium">Optional File Upload</label>
                  <input type="file" onChange={(e) => setTicketFile(e.target.files ? e.target.files[0] : null)} className="w-full p-2 border rounded" />
                </div>
                <button onClick={handleRaiseTicket} className="bg-blue-500 text-white px-4 py-2 rounded">Submit</button>
              </div>
            )}
            {showSuccess && (
              <div className="mb-4 p-4 bg-green-100 rounded">
                <p>Your ticket has been raised successfully</p>
              </div>
            )}
          </>
        ) : (
          <div>
            <h3 className="text-lg font-semibold mb-4">My Tickets</h3>
            {tickets.length === 0 ? (
              <p>No tickets yet.</p>
            ) : (
              tickets.map(ticket => (
                <div key={ticket.id} className="bg-white p-4 rounded shadow mb-2">
                  <h4 className="font-bold">{ticket.title}</h4>
                  <p>Category: {ticket.category}</p>
                  <p>Status: {ticket.status}</p>
                  <p>Date: {new Date(ticket.created_at).toLocaleDateString()}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SupportPage;
