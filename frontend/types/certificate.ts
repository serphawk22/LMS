export interface Certificate {
  id: number;
  user_id: number;
  course_id: number;
  template_id?: number | null;
  issued_at: string;
  expires_at?: string | null;
  grade?: string | null;
  data?: Record<string, any> | null;
  verification_token: string;
  share_token?: string | null;
}

export interface CertificateShareResponse {
  share_token: string;
  share_url: string;
}

export interface CertificateVerificationResult {
  valid: boolean;
  certificate?: Certificate | null;
}
