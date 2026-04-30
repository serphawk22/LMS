import api from '@/lib/api';

export interface Announcement {
  id: number;
  title: string;
  content: string;
  course_id: number | null;
  priority: string;
  target_audience: string;
  published: boolean;
  published_at: string | null;
  expires_at: string | null;
  organization_id: number;
  created_by_id: number | null;
  created_at: string;
  updated_at: string;
  created_by: {
    id: number;
    email: string;
    full_name: string | null;
  } | null;
}

export interface AnnouncementCreatePayload {
  title: string;
  content: string;
  course_id?: number | null;
  priority?: string;
  target_audience?: string;
  published?: boolean;
}

export async function fetchAnnouncements(): Promise<Announcement[]> {
  const response = await api.get('/announcements');
  return response.data;
}

export async function createAnnouncement(payload: AnnouncementCreatePayload): Promise<Announcement> {
  const response = await api.post('/announcements', payload);
  return response.data;
}