import type { UserRole } from '../constants/roles';

export interface UserProfile {
  id: string; // UUID — espeja auth.users.id de Supabase
  fullName: string;
  phone?: string;
  birthDate?: string; // ISO date YYYY-MM-DD
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  profile?: UserProfile;
}

/** Claims del JWT emitido por Supabase Auth */
export interface SupabaseJwtClaims {
  sub: string; // user id
  email: string;
  role: string;
  app_metadata: {
    role?: UserRole;
  };
  user_metadata: {
    full_name?: string;
    avatar_url?: string;
  };
  iat: number;
  exp: number;
}
