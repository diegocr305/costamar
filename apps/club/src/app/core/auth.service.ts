import { Injectable, signal } from '@angular/core';
import {
  createClient,
  SupabaseClient,
  type Session,
} from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

export interface ClubAuthUser {
  id: string;
  email: string;
  fullName?: string;
}

/**
 * Autenticación del Club con Supabase Auth (Google OAuth, flujo PKCE).
 * App SPA pura (sin SSR): la sesión persiste en el navegador.
 * NUNCA usa service_role: solo la clave publishable.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase: SupabaseClient;

  readonly user = signal<ClubAuthUser | null>(null);
  readonly ready = signal(false);

  constructor() {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseAnonKey,
      {
        auth: {
          flowType: 'pkce',
          persistSession: true,
          autoRefreshToken: true,
          // El código OAuth se intercambia manualmente en la callback.
          detectSessionInUrl: false,
        },
      },
    );

    void this.restoreSession();
    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.applySession(session);
    });
  }

  /** Inicia login con Google. Redirige a la callback de este mismo origen. */
  async loginWithGoogle(): Promise<void> {
    // redirectTo se fija al origen propio: evita open-redirect.
    const redirectTo = `${window.location.origin}${environment.authRedirectPath}`;
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, scopes: 'openid email profile' },
    });
    if (error) throw error;
  }

  /** Procesa el retorno OAuth: intercambia el código por sesión (PKCE). */
  async handleOAuthCallback(url: string): Promise<void> {
    const { error } = await this.supabase.auth.exchangeCodeForSession(url);
    if (error) throw error;
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
    const meta = session.user.user_metadata as
      | { full_name?: string; name?: string }
      | undefined;
    this.user.set({
      id: session.user.id,
      email: session.user.email ?? '',
      fullName: meta?.full_name ?? meta?.name,
    });
  }
}
