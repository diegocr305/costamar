import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import {
  createClient,
  SupabaseClient,
  type Session,
} from '@supabase/supabase-js';
import { ROLES, type UserRole } from '@costamar/shared';
import { environment } from '../../environments/environment';

export interface AdminUser {
  id: string;
  email: string;
  role: UserRole;
}

/**
 * Servicio de autenticación del panel admin.
 * Usa Supabase Auth con la clave pública (anon/publishable) y flujo PKCE.
 * NUNCA maneja service_role: eso vive solo en el backend.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly supabase: SupabaseClient;

  readonly user = signal<AdminUser | null>(null);
  readonly ready = signal(false);

  constructor() {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseAnonKey,
      {
        auth: {
          flowType: 'pkce',
          persistSession: this.isBrowser,
          autoRefreshToken: this.isBrowser,
          detectSessionInUrl: false,
        },
      },
    );

    if (this.isBrowser) {
      void this.restoreSession();
      this.supabase.auth.onAuthStateChange((_event, session) => {
        this.applySession(session);
      });
    }
  }

  /** Inicia login con Google (OAuth PKCE). Redirige a la callback. */
  async loginWithGoogle(): Promise<void> {
    const redirectTo = `${window.location.origin}${environment.authRedirectPath}`;
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        scopes: 'openid email profile',
      },
    });
    if (error) {
      throw error;
    }
  }

  /** Procesa el retorno OAuth: intercambia el código por sesión. */
  async handleOAuthCallback(url: string): Promise<void> {
    const { error } = await this.supabase.auth.exchangeCodeForSession(url);
    if (error) {
      throw error;
    }
    const { data } = await this.supabase.auth.getSession();
    this.applySession(data.session);
  }

  async logout(): Promise<void> {
    await this.supabase.auth.signOut();
    this.user.set(null);
  }

  async getAccessToken(): Promise<string | null> {
    const { data } = await this.supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  isAuthenticated(): boolean {
    return this.user() !== null;
  }

  private async restoreSession(): Promise<void> {
    const { data } = await this.supabase.auth.getSession();
    this.applySession(data.session);
    this.ready.set(true);
  }

  private applySession(session: Session | null): void {
    if (!session) {
      this.user.set(null);
      return;
    }
    const meta = session.user.app_metadata as { role?: string } | undefined;
    const role = meta?.role;
    const resolvedRole: UserRole =
      role && (ROLES as readonly string[]).includes(role)
        ? (role as UserRole)
        : 'customer';

    this.user.set({
      id: session.user.id,
      email: session.user.email ?? '',
      role: resolvedRole,
    });
  }
}
