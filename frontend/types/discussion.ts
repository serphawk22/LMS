export type DiscussionStatus = 'open' | 'closed';

export interface DiscussionAuthor {
  id: number;
  full_name: string | null;
  email: string;
}

export interface DiscussionReply {
  id: number;
  discussion_id: number;
  user_id: number;
  organization_id: number;
  message: string;
  created_at: string;
  updated_at: string;
  author: DiscussionAuthor;
  can_edit: boolean;
  can_delete: boolean;
}

export interface Discussion {
  id: number;
  title: string;
  description: string;
  category: string;
  status: DiscussionStatus;
  user_id: number;
  organization_id: number;
  created_at: string;
  updated_at: string;
  reply_count: number;
  author: DiscussionAuthor;
  can_manage_status: boolean;
  can_reply: boolean;
}

export interface DiscussionDetail extends Discussion {
  replies: DiscussionReply[];
}

export interface CreateDiscussionPayload {
  title: string;
  description: string;
  category: string;
}

export interface CreateReplyPayload {
  message: string;
}

export interface UpdateReplyPayload {
  message: string;
}
