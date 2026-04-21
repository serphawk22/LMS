'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { ModernHeader } from '@/components/ModernHeader';

interface CalendarEvent {
  id: number;
  title: string;
  date: string;
  type: 'announcement' | 'live_class';
  start_time?: string;
  end_time?: string;
  course_name?: string;
  description?: string;
}

interface DayEvents {
  [key: string]: CalendarEvent[];
}

type FilterType = 'all' | 'announcements' | 'live_classes';

export default function CalendarPage() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<CalendarEvent[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  // Fetch calendar events
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const response = await api.get('/calendar/events');
        setEvents(response.data);
      } catch (error) {
        console.error('Failed to fetch calendar events:', error);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  // Filter events based on filter type
  useEffect(() => {
    let filtered = events;
    
    if (filter === 'announcements') {
      filtered = events.filter(e => e.type === 'announcement');
    } else if (filter === 'live_classes') {
      filtered = events.filter(e => e.type === 'live_class');
    }
    
    setFilteredEvents(filtered);
  }, [events, filter]);

  // Get week dates (Mon-Sun)
  const getWeekDates = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const monday = new Date(d.setDate(diff));

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const weekDates = getWeekDates(currentDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Format date to YYYY-MM-DD for comparison
  const formatDateStr = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Get events for a specific date
  const getEventsForDate = (date: Date): CalendarEvent[] => {
    const dateStr = formatDateStr(date);
    return filteredEvents.filter(e => e.date === dateStr);
  };

  // Get events grouped by time slot for a date
  const getTimeSlotEvents = (date: Date): { [key: string]: CalendarEvent[] } => {
    const dayEvents = getEventsForDate(date);
    const liveClasses = dayEvents.filter(e => e.type === 'live_class');
    const grouped: { [key: string]: CalendarEvent[] } = {};

    liveClasses.forEach(event => {
      const time = event.start_time || '09:00';
      if (!grouped[time]) {
        grouped[time] = [];
      }
      grouped[time].push(event);
    });

    return grouped;
  };

  // Navigate to previous week
  const goToPreviousWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  // Navigate to next week
  const goToNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  // Go to today
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Handle event click
  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setShowModal(true);
  };

  // Handle join class
  const handleJoinClass = async () => {
    if (!selectedEvent || selectedEvent.type !== 'live_class') return;

    try {
      setIsJoining(true);
      // Navigate to live class page
      router.push(`/live-class/${selectedEvent.id}`);
    } catch (error) {
      console.error('Error joining class:', error);
    } finally {
      setIsJoining(false);
    }
  };

  // Time slots (9 AM to 6 PM)
  const timeSlots = Array.from({ length: 10 }, (_, i) => {
    const hour = i + 9;
    return `${String(hour).padStart(2, '0')}:00`;
  });

  // Day names
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <ModernHeader />

      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Calendar</h1>
          <p className="text-slate-600">View your announcements and live classes</p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            {/* Navigation Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={goToPreviousWeek}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
              >
                ← Previous
              </button>
              <button
                onClick={goToToday}
                className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors"
              >
                Today
              </button>
              <button
                onClick={goToNextWeek}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
              >
                Next →
              </button>
            </div>

            {/* Filter Dropdown */}
            <div className="flex items-center gap-2">
              <label className="text-slate-700 font-medium">Filter:</label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as FilterType)}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All</option>
                <option value="announcements">Announcements</option>
                <option value="live_classes">Live Classes</option>
              </select>
            </div>
          </div>

          {/* Week Range Display */}
          <div className="mt-4 text-sm text-slate-600 text-center">
            {formatDateStr(weekDates[0])} to {formatDateStr(weekDates[6])}
          </div>
        </div>

        {/* Calendar View */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-slate-600">Loading calendar...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-slate-600 text-lg">No events scheduled</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {/* Calendar Header */}
            <div className="grid grid-cols-8 border-b border-slate-200">
              <div className="p-4 bg-slate-50 border-r border-slate-200 font-semibold text-slate-700 text-sm">
                Time
              </div>
              {weekDates.map((date, idx) => {
                const isToday = formatDateStr(date) === formatDateStr(today);
                return (
                  <div
                    key={idx}
                    className={`p-4 border-r border-slate-200 text-center ${
                      isToday ? 'bg-blue-50 border-b-2 border-blue-500' : 'bg-slate-50'
                    }`}
                  >
                    <div className="font-semibold text-slate-700">{dayNames[idx]}</div>
                    <div className={`text-sm ${isToday ? 'text-blue-600 font-bold' : 'text-slate-600'}`}>
                      {date.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Calendar Body */}
            <div className="overflow-y-auto max-h-96 sm:max-h-none">
              {timeSlots.map((timeSlot) => (
                <div key={timeSlot} className="grid grid-cols-8 border-b border-slate-200 min-h-24">
                  {/* Time Column */}
                  <div className="p-3 bg-slate-50 border-r border-slate-200 text-sm font-medium text-slate-600 flex items-start justify-center">
                    {timeSlot}
                  </div>

                  {/* Day Columns */}
                  {weekDates.map((date, dayIdx) => {
                    const isToday = formatDateStr(date) === formatDateStr(today);
                    const dateStr = formatDateStr(date);
                    const dayEvents = filteredEvents.filter(
                      e =>
                        e.date === dateStr &&
                        e.type === 'live_class' &&
                        e.start_time?.startsWith(timeSlot)
                    );

                    return (
                      <div
                        key={`${dateStr}-${timeSlot}`}
                        className={`p-2 border-r border-slate-200 relative ${
                          isToday ? 'bg-blue-50' : 'bg-white'
                        }`}
                      >
                        {dayEvents.map((event) => (
                          <button
                            key={event.id}
                            onClick={() => handleEventClick(event)}
                            className="w-full text-left mb-1 p-2 bg-purple-100 hover:bg-purple-200 rounded-md text-xs font-semibold text-purple-900 truncate transition-colors"
                            title={`${event.title} ${event.start_time}-${event.end_time}`}
                          >
                            {event.title}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Announcements Row */}
              <div className="grid grid-cols-8 border-b border-slate-200">
                <div className="p-3 bg-slate-50 border-r border-slate-200 text-sm font-medium text-slate-600 flex items-start justify-center">
                  📢
                </div>

                {weekDates.map((date, dayIdx) => {
                  const isToday = formatDateStr(date) === formatDateStr(today);
                  const dateStr = formatDateStr(date);
                  const announcements = filteredEvents.filter(
                    e => e.date === dateStr && e.type === 'announcement'
                  );

                  return (
                    <div
                      key={`announcements-${dateStr}`}
                      className={`p-2 border-r border-slate-200 min-h-16 ${
                        isToday ? 'bg-blue-50' : 'bg-white'
                      }`}
                    >
                      {announcements.map((event) => (
                        <button
                          key={event.id}
                          onClick={() => handleEventClick(event)}
                          className="w-full text-left mb-1 p-2 bg-amber-100 hover:bg-amber-200 rounded-md text-xs font-semibold text-amber-900 truncate transition-colors"
                          title={event.title}
                        >
                          {event.title}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Event Modal */}
      {showModal && selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold text-slate-900">{selectedEvent.title}</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 mb-6">
              <div>
                <span className="text-sm font-semibold text-slate-600">Type:</span>
                <span className="ml-2 text-slate-900">
                  {selectedEvent.type === 'announcement' ? 'Announcement' : 'Live Class'}
                </span>
              </div>
              <div>
                <span className="text-sm font-semibold text-slate-600">Date:</span>
                <span className="ml-2 text-slate-900">{selectedEvent.date}</span>
              </div>
              {selectedEvent.type === 'live_class' && (
                <>
                  <div>
                    <span className="text-sm font-semibold text-slate-600">Time:</span>
                    <span className="ml-2 text-slate-900">
                      {selectedEvent.start_time} - {selectedEvent.end_time}
                    </span>
                  </div>
                  {selectedEvent.course_name && (
                    <div>
                      <span className="text-sm font-semibold text-slate-600">Course:</span>
                      <span className="ml-2 text-slate-900">{selectedEvent.course_name}</span>
                    </div>
                  )}
                </>
              )}
              {selectedEvent.description && (
                <div>
                  <span className="text-sm font-semibold text-slate-600">Description:</span>
                  <p className="mt-1 text-slate-700 text-sm">{selectedEvent.description}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              {selectedEvent.type === 'live_class' && (
                <button
                  onClick={handleJoinClass}
                  disabled={isJoining}
                  className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 text-white font-medium rounded-lg transition-colors"
                >
                  {isJoining ? 'Joining...' : 'Join Class'}
                </button>
              )}
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
