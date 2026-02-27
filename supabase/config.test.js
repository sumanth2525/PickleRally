const { SUPABASE_URL, SUPABASE_ANON_KEY, getSupabase } = require("./config");

describe("Supabase config", () => {
  test("URL and anon key are non-empty strings", () => {
    expect(typeof SUPABASE_URL).toBe("string");
    expect(SUPABASE_URL.length).toBeGreaterThan(0);

    expect(typeof SUPABASE_ANON_KEY).toBe("string");
    expect(SUPABASE_ANON_KEY.length).toBeGreaterThan(0);
  });

  test("URL looks like a Supabase project URL", () => {
    expect(SUPABASE_URL).toMatch(/^https:\/\/[a-z0-9-]+\.supabase\.co$/);
  });

  test("anon key looks like a Supabase publishable key", () => {
    expect(SUPABASE_ANON_KEY).toMatch(/^sb_publishable_/);
  });

  test("getSupabase returns null if global supabase is missing", () => {
    delete global.supabase;
    expect(getSupabase()).toBeNull();
  });

  test("getSupabase uses global supabase.createClient with config values", () => {
    const fakeClient = { ok: true };
    global.supabase = {
      createClient: jest.fn(() => fakeClient),
    };

    const client = getSupabase();

    expect(global.supabase.createClient).toHaveBeenCalledWith(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );
    expect(client).toBe(fakeClient);
  });
});
