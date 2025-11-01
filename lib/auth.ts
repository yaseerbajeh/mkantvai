import { supabase } from './supabase';

export type AuthError = {
  message: string;
  code?: string;
};

export type AuthResult = {
  error: AuthError | null;
  data?: any;
};

/**
 * Sign up a new user with email and password
 */
export async function signUp(email: string, password: string): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      return { error: { message: error.message, code: error.status?.toString() || error.name } };
    }

    return { error: null, data };
  } catch (err) {
    return { error: { message: 'حدث خطأ غير متوقع' } };
  }
}

/**
 * Sign in an existing user with email and password
 */
export async function signIn(email: string, password: string): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: { message: error.message, code: error.status?.toString() || error.name } };
    }

    return { error: null, data };
  } catch (err) {
    return { error: { message: 'حدث خطأ غير متوقع' } };
  }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return { error: { message: error.message } };
    }

    return { error: null };
  } catch (err) {
    return { error: { message: 'حدث خطأ غير متوقع' } };
  }
}

/**
 * Get the current user session
 */
export async function getSession() {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      return { error: { message: error.message }, session: null };
    }

    return { error: null, session: data.session };
  } catch (err) {
    return { error: { message: 'حدث خطأ غير متوقع' }, session: null };
  }
}

/**
 * Get the current user
 */
export async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      return { error: { message: error.message }, user: null };
    }

    return { error: null, user };
  } catch (err) {
    return { error: { message: 'حدث خطأ غير متوقع' }, user: null };
  }
}

