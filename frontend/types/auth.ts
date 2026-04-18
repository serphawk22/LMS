export interface TokenResponse {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in?: number;
}

export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  full_name: string;
  email: string;
  password: string;
  role: 'student' | 'instructor' | 'admin';
}

export interface UserProfile {
  id: number;
  email: string;
  full_name: string;
  role: string;
  role_name?: string;
  organization_id?: number;
  age?: number;
  joined_at?: string;
  github_url?: string;
  linkedin_url?: string;
  avatar_url?: string;
}
