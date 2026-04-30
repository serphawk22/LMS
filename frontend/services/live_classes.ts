import api from '@/lib/api';

export interface LiveClass {
  id: number;
  course_id: number;
  course_name: string;
  title: string;
  description?: string;
  scheduled_at: string;
  duration_minutes?: number;
  instructor_id?: number;
  provider: string;
  provider_join_url?: string;
  provider_meeting_id?: string;
  is_recurring: boolean;
  created_at: string;
  updated_at: string;
  instructor?: {
    id: number;
    email: string;
    full_name?: string;
  };
}

export interface LiveClassForStudent extends LiveClass {
  is_ongoing: boolean;
  is_past: boolean;
}

export interface CreateLiveClassPayload {
  course_name: string;
  title: string;
  description?: string;
  start_time: string;
  duration: number;
}

export interface UpdateLiveClassPayload {
  title?: string;
  description?: string;
  start_time?: string;
  duration?: number;
}

/**
 * List live classes (requires course_name or instructor_id filter)
 */
export async function listLiveClasses(
  courseName?: string,
  instructorId?: number,
  upcomingOnly?: boolean,
  limit: number = 50,
  offset: number = 0
): Promise<LiveClass[]> {
  if (!courseName && !instructorId) {
    throw new Error('Either course_name or instructor_id must be provided');
  }

  const params = new URLSearchParams();
  if (courseName) params.append('course_name', courseName);
  if (instructorId) params.append('instructor_id', instructorId.toString());
  if (upcomingOnly) params.append('upcoming_only', 'true');
  params.append('limit', limit.toString());
  params.append('offset', offset.toString());

  try {
    const response = await api.get(`/live-classes?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching live classes:', error);
    throw error;
  }
}

/**
 * Get live classes for current student's enrolled courses
 */
export async function getStudentLiveClasses(
  upcomingOnly: boolean = true,
  limit: number = 50,
  offset: number = 0
): Promise<LiveClassForStudent[]> {
  const params = new URLSearchParams();
  params.append('upcoming_only', upcomingOnly.toString());
  params.append('limit', limit.toString());
  params.append('offset', offset.toString());

  const response = await api.get(`/live-classes/student/upcoming?${params.toString()}`);
  return response.data;
}

/**
 * Get a specific live class
 */
export async function getLiveClass(liveClassId: number): Promise<LiveClass> {
  const response = await api.get(`/live-classes/${liveClassId}`);
  return response.data;
}

/**
 * Create a new live class
 */
export async function createLiveClass(
  payload: CreateLiveClassPayload
): Promise<LiveClass> {
  const response = await api.post('/live-classes/', payload);
  return response.data;
}

/**
 * Update a live class
 */
export async function updateLiveClass(
  liveClassId: number,
  payload: UpdateLiveClassPayload
): Promise<LiveClass> {
  const response = await api.patch(`/live-classes/${liveClassId}`, payload);
  return response.data;
}

/**
 * Delete a live class
 */
export async function deleteLiveClass(liveClassId: number): Promise<void> {
  await api.delete(`/live-classes/${liveClassId}`);
}

/**
 * Mark attendance for a live class
 */
export async function markAttendance(
  liveClassId: number,
  status: string = 'present'
): Promise<void> {
  await api.post(`/live-classes/${liveClassId}/attendance?status=${status}`);
}
