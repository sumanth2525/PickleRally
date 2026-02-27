/**
 * Supabase configuration
 * Get your URL and anon key from: https://supabase.com/dashboard/project/_/settings/api
 */
const SUPABASE_URL = "https://oilllromhbrhezeaftxu.supabase.co";   // e.g. https://xxxxx.supabase.co
const SUPABASE_ANON_KEY = "sb_publishable_CghD0TiwUSrkIF2xbQEX5w_lpcYk4yp";

// Initialize Supabase (loaded after supabase lib)
function getSupabase() {
  if (typeof supabase === "undefined") return null;
  return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Export for Node/Jest tests without breaking browser usage
if (typeof module !== "undefined" && module.exports) {
  module.exports = { SUPABASE_URL, SUPABASE_ANON_KEY, getSupabase };
}
