class AuthService {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
  }

  async getSession() {
    const { data: { session } } = await this.supabase.auth.getSession();
    return session;
  }

  async signInWithPassword(email, password) {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.session;
  }

  async signInWithOAuth(provider, options) {
    const { error } = await this.supabase.auth.signInWithOAuth({ provider, options });
    if (error) throw error;
  }

  async signUp(email, password) {
    const { data, error } = await this.supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data.user;
  }

  async signOut() {
    await this.supabase.auth.signOut();
  }
}