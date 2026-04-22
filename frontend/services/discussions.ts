import api from '@/lib/api';
import type {
  CreateDiscussionPayload,
  CreateReplyPayload,
  Discussion,
  DiscussionDetail,
  UpdateReplyPayload,
} from '@/types/discussion';

export async function fetchDiscussions(search?: string, category?: string): Promise<Discussion[]> {
  const response = await api.get('/discussions', {
    params: {
      ...(search ? { search } : {}),
      ...(category && category !== 'All' ? { category } : {}),
    },
  });
  return response.data;
}

export async function fetchDiscussion(discussionId: number): Promise<DiscussionDetail> {
  const response = await api.get(`/discussions/${discussionId}`);
  return response.data;
}

export async function createDiscussion(payload: CreateDiscussionPayload): Promise<DiscussionDetail> {
  const response = await api.post('/discussions', payload);
  return response.data;
}

export async function createDiscussionReply(discussionId: number, payload: CreateReplyPayload): Promise<DiscussionDetail> {
  const response = await api.post(`/discussions/${discussionId}/replies`, payload);
  return response.data;
}

export async function updateDiscussionReply(replyId: number, payload: UpdateReplyPayload): Promise<DiscussionDetail> {
  const response = await api.put(`/replies/${replyId}`, payload);
  return response.data;
}

export async function deleteDiscussionReply(replyId: number): Promise<DiscussionDetail> {
  const response = await api.delete(`/replies/${replyId}`);
  return response.data;
}

export async function updateDiscussionStatus(discussionId: number, status: 'open' | 'closed'): Promise<DiscussionDetail> {
  const response = await api.patch(`/discussions/${discussionId}/status`, { status });
  return response.data;
}
