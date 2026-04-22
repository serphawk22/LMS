import api from '@/lib/api';

export interface FeedbackPayload {
  query: string;
  helpful: boolean;
  timestamp: string;
}

export interface FeedbackResponse {
  message: string;
  feedback_id?: number;
}

/**
 * Submit user feedback for AI support responses
 * @param payload - Feedback data including query, helpful status, and timestamp
 * @returns Response with success message
 */
export async function submitFeedback(payload: FeedbackPayload): Promise<FeedbackResponse> {
  try {
    const response = await api.post<FeedbackResponse>('/support/feedback', payload);
    return response.data;
  } catch (error) {
    console.error('Error submitting feedback:', error);
    throw error;
  }
}

/**
 * Get AI help for a support query
 * @param query - The user's support question
 * @returns AI-generated response
 */
export async function getAIHelp(query: string): Promise<{ answer: string }> {
  try {
    const response = await api.post<{ answer: string }>('/support/ai-help', { query });
    return response.data;
  } catch (error) {
    console.error('Error getting AI help:', error);
    throw error;
  }
}

/**
 * Raise a support ticket
 * @param formData - FormData containing ticket information and optional file
 * @returns Response with ticket ID
 */
export async function raiseTicket(formData: FormData): Promise<{ message: string; ticket_id: number }> {
  try {
    const response = await api.post<{ message: string; ticket_id: number }>('/support/raise-ticket', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error raising ticket:', error);
    throw error;
  }
}

/**
 * Get all support tickets
 * @returns List of support tickets
 */
export async function getTickets(): Promise<any[]> {
  try {
    const response = await api.get('/support/tickets');
    return response.data.tickets;
  } catch (error) {
    console.error('Error fetching tickets:', error);
    throw error;
  }
}
