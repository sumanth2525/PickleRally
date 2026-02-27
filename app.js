/**
 * PickleRally — Pickleball Events & Player Finding
 * Mobile-app-style web interface + Supabase backend
 */

// Fallback mock data when Supabase / external DB not configured (with lat/lng for Nearby)
const mockEvents = [
  { id: "1", title: "Open Play — Sunrise Courts", type: "open", date: "Today, 4:00 PM", location: "Sunrise Park · 2 courts", max_players: 8, lat: 37.78, lng: -122.42 },
  { id: "2", title: "Doubles League Night", type: "league", date: "Tomorrow, 6:30 PM", location: "Riverside Rec Center", max_players: 16, lat: 37.77, lng: -122.40 },
  { id: "3", title: "Beginner Round Robin", type: "open", date: "Sat, Mar 1 · 9:00 AM", location: "Community Center", max_players: 12, lat: 37.76, lng: -122.45 },
  { id: "4", title: "City Championship Qualifier", type: "tournament", date: "Sun, Mar 2 · 8:00 AM", location: "Downtown Sports Complex", max_players: 32, lat: 37.77, lng: -122.41 },
  { id: "5", title: "Friday Night Mixer", type: "open", date: "Fri, Feb 28 · 7:00 PM", location: "Oak Street Courts · 4 courts", max_players: 20, lat: 37.79, lng: -122.43 },
  { id: "6", title: "3.0+ Skill Clinic", type: "league", date: "Sat, Mar 1 · 10:00 AM", location: "Lakeside Tennis & Pickleball", max_players: 12, lat: 37.74, lng: -122.47 },
  { id: "7", title: "Sunday Social Doubles", type: "open", date: "Sun, Mar 2 · 2:00 PM", location: "Westside Community Park", max_players: 16, lat: 37.75, lng: -122.46 },
  { id: "8", title: "Spring Invitational", type: "tournament", date: "Sat, Mar 8 · 8:00 AM", location: "Midtown Athletic Club", max_players: 48, lat: 37.78, lng: -122.44 },
  { id: "9", title: "Lunch Drop-In", type: "open", date: "Mon, Mar 3 · 12:00 PM", location: "Downtown YMCA · 2 courts", max_players: 8, lat: 37.77, lng: -122.42 },
  { id: "10", title: "Women's Doubles Night", type: "league", date: "Wed, Mar 5 · 6:00 PM", location: "Riverside Rec Center", max_players: 16, lat: 37.77, lng: -122.40 }
];
const mockPlayers = [
  { id: "1", name: "Alex M.", skill: "3.5", location: "Downtown", lat: 37.77, lng: -122.41 },
  { id: "2", name: "Jordan K.", skill: "4.0", location: "Riverside", lat: 37.77, lng: -122.40 },
  { id: "3", name: "Sam T.", skill: "2.5", location: "Westside", lat: 37.75, lng: -122.46 },
  { id: "4", name: "Casey R.", skill: "3.0", location: "Sunrise", lat: 37.79, lng: -122.43 },
  { id: "5", name: "Riley P.", skill: "4.5", location: "Midtown", lat: 37.78, lng: -122.44 },
  { id: "6", name: "Morgan L.", skill: "3.0", location: "Lakeside", lat: 37.74, lng: -122.47 },
  { id: "7", name: "Taylor W.", skill: "5.0", location: "Downtown", lat: 37.77, lng: -122.42 }
];

let events = [];
let players = [];
let userLocation = null;
let chatChannel = null;
let currentChatRoomId = null;
let currentEventId = null;
let liveCount = 0;
let liveCountBase = 0; // random 9-15, set once
let presenceChannel = null;
const joinedEvents = new Set();
const playerRequests = new Set();

// Feature flags: events/players/chat use Supabase
const USE_SUPABASE_DATA = true;
const USE_SUPABASE_CHAT = true;

// --- Test helpers (no-op in browser, used by Jest) ---
function __setEventsForTest(list) {
  events = Array.isArray(list) ? list : [];
}

function __setPlayersForTest(list) {
  players = Array.isArray(list) ? list : [];
}

function getSupabaseClient() {
  try {
    if (typeof getSupabase !== "undefined" && typeof SUPABASE_URL !== "undefined" && SUPABASE_URL !== "YOUR_SUPABASE_URL") {
      const client = getSupabase();
      if (client) return client;
    }
  } catch (e) {
    console.warn("Supabase not configured, using mock data:", e.message);
  }
  return null;
}

const sb = getSupabaseClient();
const useSupabase = !!sb;

// --- Live location ---
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function getUserLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}

async function fetchEvents() {
  if (useSupabase && USE_SUPABASE_DATA) {
    const { data, error } = await sb.from("events").select("*").order("created_at", { ascending: false });
    if (error) {
      console.error("Supabase events error:", error);
      // If Supabase errors, fall back to local mock events
      events = mockEvents.map(e => ({ ...e, spots: `${e.max_players} spots` }));
    } else if (!data || data.length === 0) {
      // If Supabase is configured but has no rows yet, still show mock events
      events = mockEvents.map(e => ({ ...e, spots: `${e.max_players} spots` }));
    } else {
      events = data.map(e => ({ ...e, spots: `${e.max_players} spots` }));
    }
  } else {
    events = mockEvents.map(e => ({ ...e, spots: `${e.max_players} spots` }));
  }
  events.forEach(e => { if (!e.lat) e.lat = mockEvents.find(m => m.id === String(e.id))?.lat; if (!e.lng) e.lng = mockEvents.find(m => m.id === String(e.id))?.lng; });
}

async function fetchPlayers() {
  if (useSupabase && USE_SUPABASE_DATA) {
    const { data, error } = await sb.from("players").select("*").order("name");
    if (error) {
      console.error("Supabase players error:", error);
      players = mockPlayers.map(p => ({ ...p, initial: (p.name || "?")[0] }));
    } else if (!data || data.length === 0) {
      players = mockPlayers.map(p => ({ ...p, initial: p.name[0] }));
    } else {
      players = data.map(p => ({ ...p, initial: (p.name || "?")[0] }));
    }
  } else {
    players = mockPlayers.map(p => ({ ...p, initial: p.name[0] }));
  }
}

function init() {
  initNavigation();
  initSearch();
  initSkillFilters();
  initFab();
  initAddEventForm();
  initDiagnostics();
  initMenu();
  initLiveCount();
  initAuth();
  initNearby();
  initEventDetails();
  initChat();
  loadData();
}

async function loadData() {
  const eventList = document.getElementById("event-list");
  const playerList = document.getElementById("player-list");
  if (eventList) {
    eventList.innerHTML = '<p class="empty">Loading...</p>';
  }
  if (playerList) {
    playerList.innerHTML = '<p class="empty">Loading...</p>';
  }

  await Promise.all([fetchEvents(), fetchPlayers()]);
  renderEvents();
  renderPlayers();
}

function typeLabel(type) {
  return { open: "Open Play", league: "League", tournament: "Tournament" }[type] || type;
}

function spotsLabel(e) {
  return e.spots || `${e.max_players || 0} spots`;
}

function renderEvents(data) {
  const list = document.getElementById("event-list");
  if (!list) return;
  const items = data || events;
  list.innerHTML = items.map(e => {
    const dist = (userLocation && e.lat != null) ? getDistance(userLocation.lat, userLocation.lng, e.lat, e.lng).toFixed(1) + " mi" : null;
    const joined = joinedEvents.has(String(e.id));
    const joinLabel = joined ? "Joined" : "Join";
    const joinClass = joined ? "event-join event-join-joined" : "event-join";

    return `
    <article class="event-card" data-id="${e.id}">
      <div class="event-card-header">
        <h3>${escapeHtml(e.title)}</h3>
        <span class="event-badge ${e.type}">${typeLabel(e.type)}</span>
      </div>
      <div class="event-meta">
        <span>📅 ${escapeHtml(e.date)}</span>
        <span>📍 ${escapeHtml(e.location)}${dist ? " · " + dist : ""}</span>
      </div>
      <div class="event-card-footer">
        <span class="event-spots">${spotsLabel(e)}</span>
        <button class="${joinClass}" data-id="${e.id}">${joinLabel}</button>
      </div>
    </article>`;
  }).join("");
  if (items.length === 0) list.innerHTML = '<p class="empty">No events yet</p>';
}

function findEventById(id) {
  if (!id) return null;
  return events.find(e => String(e.id) === String(id)) || null;
}

function updateEventSpots(id, delta) {
  const ev = findEventById(id);
  if (!ev) return;
  let current;
  if (typeof ev.spots === "string") {
    const m = ev.spots.match(/\d+/);
    current = m ? parseInt(m[0], 10) : (ev.max_players || 0);
  } else {
    current = ev.max_players || 0;
  }
  current = Math.max(0, current + delta);
  ev.spots = `${current} spots`;
}

function openEventDetail(id) {
  const overlay = document.getElementById("event-detail-overlay");
  const typeEl = document.getElementById("event-detail-type");
  const titleEl = document.getElementById("event-detail-title");
  const whenEl = document.getElementById("event-detail-when");
  const whereEl = document.getElementById("event-detail-where");
  const spotsEl = document.getElementById("event-detail-spots");
  const joinBtn = document.getElementById("event-detail-join");
  if (!overlay || !typeEl || !titleEl || !whenEl || !whereEl || !spotsEl) return;

  const ev = findEventById(id);
  if (!ev) return;

  currentEventId = id;

  titleEl.textContent = ev.title || "Event";
  typeEl.textContent = typeLabel(ev.type || "open");
  whenEl.textContent = ev.date || ev.start_time || "Date & time coming soon";
  whereEl.textContent = ev.location || ev.address || "Location coming soon";
  spotsEl.textContent = spotsLabel(ev);

  // Sync join button state with list
  if (joinBtn) {
    const joined = joinedEvents.has(id);
    joinBtn.textContent = joined ? "Joined" : "Join this event";
    joinBtn.classList.toggle("event-join-joined", joined);
  }

  overlay.style.display = "flex";
  document.body.style.overflow = "hidden";
}

function closeEventDetail() {
  const overlay = document.getElementById("event-detail-overlay");
  if (!overlay) return;
  overlay.style.display = "none";
  document.body.style.overflow = "";
}

function initEventDetails() {
  const overlay = document.getElementById("event-detail-overlay");
  const backdrop = document.getElementById("event-detail-backdrop");
  const closeBtn = document.getElementById("event-detail-close");
  const joinBtn = document.getElementById("event-detail-join");

  if (!overlay) return;

  backdrop?.addEventListener("click", closeEventDetail);
  closeBtn?.addEventListener("click", closeEventDetail);
  joinBtn?.addEventListener("click", () => {
    if (!currentEventId) return;
    const joined = joinedEvents.has(currentEventId);
    const listJoinBtn = document.querySelector(
      `.event-card[data-id="${currentEventId}"] .event-join`
    );

    if (joined) {
      joinedEvents.delete(currentEventId);
      updateEventSpots(currentEventId, +1);
      joinBtn.textContent = "Join this event";
      joinBtn.classList.remove("event-join-joined");
      if (listJoinBtn) {
        listJoinBtn.textContent = "Join";
        listJoinBtn.classList.remove("event-join-joined");
      }
    } else {
      joinedEvents.add(currentEventId);
      updateEventSpots(currentEventId, -1);
      joinBtn.textContent = "Joined";
      joinBtn.classList.add("event-join-joined");
      if (listJoinBtn) {
        listJoinBtn.textContent = "Joined";
        listJoinBtn.classList.add("event-join-joined");
      }
      alert("You have joined this event (local only for now).");
    }

    // Re-render list to reflect updated spots and join state
    renderEvents();
  });
}

function renderPlayers(filter = "all", data) {
  const list = document.getElementById("player-list");
  if (!list) return;
  let items = data || players;
  if (filter !== "all") {
    const level = parseFloat(filter);
    items = items.filter(p => {
      const s = parseFloat(p.skill);
      return s >= level - 0.5 && s <= level + 0.5;
    });
  }
  list.innerHTML = items.map(p => {
    const dist = (userLocation && p.lat != null) ? getDistance(userLocation.lat, userLocation.lng, p.lat, p.lng).toFixed(1) + " mi away" : null;
    const requested = playerRequests.has(String(p.id));
    const btnText = requested ? "✓" : "+";
    const btnClass = requested ? "player-action player-action-sent" : "player-action";
    return `
    <article class="player-card" data-id="${p.id}">
      <div class="player-avatar">${escapeHtml((p.initial || p.name || "?")[0])}</div>
      <div class="player-info">
        <h3>${escapeHtml(p.name)}</h3>
        <div class="player-skill">Skill: ${escapeHtml(p.skill)}</div>
        <div class="player-location">${escapeHtml(p.location)}${dist ? " · " + dist : ""}</div>
      </div>
      <button class="${btnClass}" aria-label="Connect with ${escapeHtml(p.name)}">${btnText}</button>
    </article>`;
  }).join("");
  if (items.length === 0) list.innerHTML = '<p class="empty">No players found</p>';
}

function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function initNavigation() {
  const navItems = document.querySelectorAll(".nav-item");
  const panels = document.querySelectorAll(".tab-panel");
  navItems.forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const tab = item.dataset.tab;
      navItems.forEach(n => n.classList.remove("active"));
      panels.forEach(p => p.classList.remove("active"));
      item.classList.add("active");
      document.getElementById(`tab-${tab}`).classList.add("active");
    });
  });
  const hash = (location.hash || "#events").slice(1);
  const target = document.querySelector(`[data-tab="${hash}"]`);
  if (target) {
    navItems.forEach(n => n.classList.remove("active"));
    panels.forEach(p => p.classList.remove("active"));
    target.classList.add("active");
    document.getElementById(`tab-${hash}`).classList.add("active");
  }
}

function initSearch() {
  const eventSearch = document.getElementById("event-search");
  const playerSearch = document.getElementById("player-search");
  if (eventSearch) {
    eventSearch.addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase();
      const filtered = events.filter(ev =>
        (ev.title || "").toLowerCase().includes(q) ||
        (ev.location || "").toLowerCase().includes(q)
      );
      renderEvents(filtered);
    });
  }
  if (playerSearch) {
    playerSearch.addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase();
      const activeSkill = document.querySelector(".chip.active")?.dataset.skill || "all";
      let filtered = players.filter(p =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.skill || "").includes(q) ||
        (p.location || "").toLowerCase().includes(q)
      );
      if (activeSkill !== "all") {
        const level = parseFloat(activeSkill);
        filtered = filtered.filter(p => {
          const s = parseFloat(p.skill);
          return s >= level - 0.5 && s <= level + 0.5;
        });
      }
      renderPlayers(activeSkill, filtered);
    });
  }
}

function initSkillFilters() {
  document.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      renderPlayers(chip.dataset.skill);
    });
  });
}

function openAddEventForm() {
  const overlay = document.getElementById("add-event-overlay");
  const form = document.getElementById("add-event-form");
  const msg = document.getElementById("add-event-message");
  if (!overlay || !form) return;
  form.reset();
  document.getElementById("add-event-max").value = "16";
  if (msg) msg.textContent = "";
  msg.className = "auth-message";
  overlay.style.display = "flex";
  document.body.style.overflow = "hidden";
  document.getElementById("add-event-title")?.focus();
}

function closeAddEventForm() {
  const overlay = document.getElementById("add-event-overlay");
  if (!overlay) return;
  overlay.style.display = "none";
  document.body.style.overflow = "";
}

function initAddEventForm() {
  const overlay = document.getElementById("add-event-overlay");
  const form = document.getElementById("add-event-form");
  const backdrop = document.getElementById("add-event-backdrop");
  const closeBtn = document.getElementById("add-event-close");
  const cancelBtn = document.getElementById("add-event-cancel");

  if (!overlay || !form) return;

  backdrop?.addEventListener("click", closeAddEventForm);
  closeBtn?.addEventListener("click", closeAddEventForm);
  cancelBtn?.addEventListener("click", closeAddEventForm);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("add-event-title")?.value?.trim();
    const type = document.getElementById("add-event-type")?.value || "open";
    const date = document.getElementById("add-event-date")?.value?.trim();
    const location = document.getElementById("add-event-location")?.value?.trim();
    const max = parseInt(document.getElementById("add-event-max")?.value || "16", 10) || 16;

    if (!title || !date || !location) {
      const msg = document.getElementById("add-event-message");
      if (msg) {
        msg.textContent = "Please fill in title, date, and location.";
        msg.className = "auth-message error";
      }
      return;
    }

    closeAddEventForm();
    await doCreateEvent({ title, type, date, location, max });
  });
}

async function doCreateEvent(payload) {
  const { title, type, date, location, max } = payload;

  // Capture geolocation for "Nearby" sorting when creating events.
  let loc = null;
  try {
    loc = await getUserLocation();
  } catch (e) {
    console.warn("Could not get user geolocation for event:", e);
  }

  if (useSupabase && USE_SUPABASE_DATA) {
    // Attach browser location (lat/lng) when available so "Nearby" works with Supabase data
    let payload = { title, type, date, location, max_players: max };
    if (loc && typeof loc.lat === "number" && typeof loc.lng === "number") {
      payload.lat = loc.lat;
      payload.lng = loc.lng;
    }

    const { data, error } = await sb.from("events").insert(payload).select().single();
    if (!error && data) {
      events.unshift({ ...data, spots: `${max} spots` });
      renderEvents();
      return;
    }
    alert("Could not create event via Supabase. It will be added locally only.\n" + (error?.message || ""));
  }

  // Local fallback when Supabase is unavailable: add to in-memory list so the UI still updates
  const localId = "local-" + Date.now();
  events.unshift({
    id: localId,
    title,
    type,
    date,
    location,
    max_players: max,
    spots: `${max} spots`,
  });
  renderEvents();
}

function initAuth() {
  const guest = document.getElementById("profile-guest");
  const logged = document.getElementById("profile-logged");
  const emailEl = document.getElementById("profile-email");
  const subtitle = document.getElementById("profile-subtitle");
  const avatar = document.getElementById("profile-avatar");
  const title = document.getElementById("profile-title");
  const msg = document.getElementById("auth-message");

  function setAuthMessage(type, text) {
    if (!msg) return;
    msg.textContent = text || "";
    msg.className = "auth-message" + (type ? " " + type : "");
  }

  function updateAuthUI(user) {
    if (user) {
      if (guest) guest.style.display = "none";
      if (logged) logged.style.display = "flex";
      if (emailEl) emailEl.textContent = user.email;
      if (subtitle) subtitle.textContent = "You're signed in";
      if (avatar) avatar.textContent = (user.email || "?")[0].toUpperCase();
      if (title) title.textContent = "Your Profile";
      if (logged) logged.style.flexDirection = "column";
    } else {
      if (guest) guest.style.display = "block";
      if (logged) logged.style.display = "none";
      if (subtitle) subtitle.textContent = "Sign in to join events & find players";
      if (avatar) avatar.textContent = "?";
      if (title) title.textContent = "Your Profile";
      setAuthMessage("", "");
    }
  }

  if (useSupabase && sb) {
    sb.auth.onAuthStateChange((_ev, session) => {
      const user = session?.user ?? null;
      updateAuthUI(user);
      updateChatAuthState(user);
    });
    sb.auth.getSession().then(({ data }) => {
      const user = data.session?.user ?? null;
      updateAuthUI(user);
      updateChatAuthState(user);
    });
  } else {
    const hint = document.querySelector(".auth-hint");
    if (hint) hint.textContent = "Configure Supabase for auth to enable sign-in.";
    setAuthMessage("error", "Supabase auth is not configured. Email and social sign-in will not work yet.");
  }

  document.getElementById("auth-signin")?.addEventListener("click", async () => {
    if (!useSupabase) { setAuthMessage("error", "Supabase auth is not configured."); return; }
    const email = document.getElementById("auth-email")?.value?.trim();
    const password = document.getElementById("auth-password")?.value;
    if (!email || !password) { setAuthMessage("error", "Enter email and password."); return; }
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) setAuthMessage("error", error.message);
    else setAuthMessage("success", "Signed in successfully.");
  });

  document.getElementById("auth-signup")?.addEventListener("click", async () => {
    if (!useSupabase) { setAuthMessage("error", "Supabase auth is not configured."); return; }
    const email = document.getElementById("auth-email")?.value?.trim();
    const password = document.getElementById("auth-password")?.value;
    if (!email || !password) { setAuthMessage("error", "Enter email and password (min 6 characters)."); return; }
    if (password.length < 6) { setAuthMessage("error", "Password must be at least 6 characters."); return; }
    const { error } = await sb.auth.signUp({ email, password });
    if (error) setAuthMessage("error", error.message);
    else setAuthMessage("success", "Check your email to confirm your account.");
  });

  document.getElementById("auth-signout")?.addEventListener("click", async () => {
    if (useSupabase && sb) await sb.auth.signOut();
    updateAuthUI(null);
  });

  document.getElementById("auth-google")?.addEventListener("click", () => {
    setAuthMessage("error", "Google sign-in is coming soon. Configure Google OAuth in Supabase.");
  });

  document.getElementById("auth-apple")?.addEventListener("click", () => {
    setAuthMessage("error", "Apple sign-in is coming soon. Configure Apple OAuth in Supabase.");
  });

  document.getElementById("auth-phone")?.addEventListener("click", () => {
    setAuthMessage("error", "Phone & OTP sign-in is coming soon. Enable Phone auth in Supabase.");
  });

  // Profile logged-in actions
  document.getElementById("profile-my-events")?.addEventListener("click", () => {
    alert("My Events — showing events you have joined is coming soon.");
  });

  document.getElementById("profile-notifications")?.addEventListener("click", () => {
    alert("Notifications — in-app and push alerts are coming soon.");
  });
}

// --- Chat (Supabase Realtime global room) ---
async function ensureGlobalChatRoom(user) {
  if (!USE_SUPABASE_CHAT || !useSupabase || !sb || !user) return null;
  if (currentChatRoomId) return currentChatRoomId;

  // Find or create a single global chat room
  let roomId = null;
  const { data: existing, error: roomErr } = await sb
    .from("chat_rooms")
    .select("id")
    .eq("title", "Global Chat")
    .eq("is_group", true)
    .limit(1)
    .maybeSingle();

  if (roomErr) {
    console.warn("chat_rooms lookup error", roomErr);
  }

  if (existing && existing.id) {
    roomId = existing.id;
  } else {
    const { data: created, error: createErr } = await sb
      .from("chat_rooms")
      .insert({ title: "Global Chat", is_group: true })
      .select("id")
      .single();
    if (createErr) {
      console.warn("chat_rooms create error", createErr);
      alert("Could not create global chat room.\n" + createErr.message);
      return null;
    }
    roomId = created.id;
  }

  // Ensure current user is a member
  const { error: memberErr } = await sb
    .from("chat_room_members")
    .upsert(
      { room_id: roomId, user_id: user.id },
      { onConflict: "room_id,user_id", ignoreDuplicates: true }
    );
  if (memberErr) {
    console.warn("chat_room_members upsert error", memberErr);
    alert("Could not join global chat room.\n" + memberErr.message);
  }

  currentChatRoomId = roomId;
  return roomId;
}

async function loadChatHistory(roomId, user) {
  const messagesEl = document.getElementById("chat-messages");
  if (!messagesEl) return;
  messagesEl.innerHTML = '<p class="empty">Loading messages…</p>';

  const { data, error } = await sb
    .from("messages")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    console.warn("loadChatHistory error", error);
    messagesEl.innerHTML = '<p class="empty">Unable to load messages.</p>';
    return;
  }

  renderChatMessages(data || [], user);
}

function renderChatMessages(items, user) {
  const messagesEl = document.getElementById("chat-messages");
  if (!messagesEl) return;
  if (!items.length) {
    messagesEl.innerHTML = '<p class="empty">Say hi to other players!</p>';
    return;
  }
  messagesEl.innerHTML = "";
  items.forEach((m) => appendChatMessage(m, user, false));
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function appendChatMessage(message, user, scroll = true) {
  const messagesEl = document.getElementById("chat-messages");
  if (!messagesEl) return;
  const isSelf = user && message.sender_id === user.id;

  const wrapper = document.createElement("div");
  wrapper.className = "chat-message" + (isSelf ? " chat-message-self" : "");
  wrapper.innerHTML = `
    <div>${escapeHtml(message.content || "")}</div>
    <div class="chat-message-meta">${new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
  `;
  messagesEl.appendChild(wrapper);
  if (scroll) {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}

async function initChat() {
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  if (!form || !input || !useSupabase || !sb || !USE_SUPABASE_CHAT) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    const { data: auth } = await sb.auth.getUser();
    const user = auth?.user;
    if (!user) {
      alert("Sign in on the Profile tab to send messages.");
      return;
    }

    const roomId = await ensureGlobalChatRoom(user);
    if (!roomId) {
      // ensureGlobalChatRoom already surfaced an alert if it failed
      return;
    }

    input.value = "";
    input.focus();

    const { data, error } = await sb
      .from("messages")
      .insert({ room_id: roomId, sender_id: user.id, content: text })
      .select("*")
      .single();
    if (error) {
      console.warn("send message error", error);
      alert("Could not send message via Supabase.\n" + (error.message || "Check Supabase RLS policies for messages table."));
      // Local fallback so the user still sees their message
      appendChatMessage(
        {
          id: "local-" + Date.now(),
          room_id: roomId,
          sender_id: user.id,
          content: text,
          created_at: new Date().toISOString(),
        },
        user,
        true
      );
    } else if (data) {
      // Optimistic append in case Realtime is not enabled
      appendChatMessage(data, user, true);
    }
  });
}

async function updateChatAuthState(user) {
  const unauthEl = document.getElementById("chat-unauth");
  const wrapperEl = document.getElementById("chat-wrapper");
  const input = document.getElementById("chat-input");
  const sendBtn = document.querySelector(".chat-send-btn");

  if (!unauthEl || !wrapperEl) return;

  if (!USE_SUPABASE_CHAT || !useSupabase || !sb) {
    unauthEl.textContent = "Chat is disabled while Supabase is used only for login.";
    unauthEl.style.display = "block";
    wrapperEl.style.display = "none";
    return;
  }

  if (!user) {
    unauthEl.style.display = "block";
    wrapperEl.style.display = "none";
    if (input) input.disabled = true;
    if (sendBtn) sendBtn.disabled = true;
    if (chatChannel) {
      sb.removeChannel(chatChannel);
      chatChannel = null;
      currentChatRoomId = null;
    }
    return;
  }

  unauthEl.style.display = "none";
  wrapperEl.style.display = "flex";
  if (input) input.disabled = false;
  if (sendBtn) sendBtn.disabled = false;

  const roomId = await ensureGlobalChatRoom(user);
  if (!roomId) return;

  await loadChatHistory(roomId, user);

  if (chatChannel) {
    sb.removeChannel(chatChannel);
  }

  chatChannel = sb
    .channel(`room:${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        appendChatMessage(payload.new, user, true);
      }
    )
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        console.warn("Chat channel error");
      }
    });
}

function initNearby() {
  const eventsNearby = document.getElementById("events-nearby");
  const playersNearby = document.getElementById("players-nearby");

  async function applyNearby(target) {
    const loc = await getUserLocation();
    if (!loc) {
      alert("Location denied or unavailable. Enable location in your browser.");
      return;
    }
    userLocation = loc;
    if (target === "events") {
      const sorted = [...events].filter(e => e.lat != null).sort((a, b) =>
        getDistance(loc.lat, loc.lng, a.lat, a.lng) - getDistance(loc.lat, loc.lng, b.lat, b.lng)
      );
      const rest = events.filter(e => e.lat == null);
      renderEvents([...sorted, ...rest]);
    } else {
      const sorted = [...players].filter(p => p.lat != null).sort((a, b) =>
        getDistance(loc.lat, loc.lng, a.lat, a.lng) - getDistance(loc.lat, loc.lng, b.lat, b.lng)
      );
      const rest = players.filter(p => p.lat == null);
      renderPlayers(document.querySelector(".chip.active")?.dataset.skill || "all", [...sorted, ...rest]);
    }
  }

  eventsNearby?.addEventListener("click", () => applyNearby("events"));
  playersNearby?.addEventListener("click", () => applyNearby("players"));
}

function initDiagnostics() {
  const btn = document.getElementById("test-btn");
  if (!btn) return;
  btn.addEventListener("click", runDiagnostics);
}

// Add your public cam links here. Each item: { label: "Camera name", url: "https://..." }
const TRAFFIC_CAM_LINKS = [
  { label: "Diadem Pickleball Complex (Florida)", url: "https://livepickleballcourts.com/facilities/diadem-pickleball-complex-florida" },
  { label: "511.org Traffic (Bay Area)", url: "https://511.org/traffic" },
  // Add more links, e.g.:
  // { label: "Caltrans Cameras", url: "https://cwwp2.dot.ca.gov/vm/iframes/" },
];

function renderLiveCamsList() {
  const container = document.getElementById("live-cams-list");
  if (!container) return;
  if (!TRAFFIC_CAM_LINKS || TRAFFIC_CAM_LINKS.length === 0) {
    container.innerHTML = '<p class="empty">Add links in app.js (TRAFFIC_CAM_LINKS) to show public cams.</p>';
    return;
  }
  container.innerHTML = TRAFFIC_CAM_LINKS.map(
    (cam) => `<a class="live-cam-link" href="${escapeHtml(cam.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(cam.label)}</a>`
  ).join("");
}

function initMenu() {
  const menuBtn = document.getElementById("menu-btn");
  const dropdown = document.getElementById("menu-dropdown");
  const liveCamsItem = document.getElementById("menu-live-cams");
  const overlay = document.getElementById("live-cams-overlay");
  const closeBtn = document.getElementById("live-cams-close");

  if (!menuBtn || !dropdown) return;

  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("open");
  });

  document.addEventListener("click", () => {
    dropdown.classList.remove("open");
  });

  if (liveCamsItem) {
    liveCamsItem.addEventListener("click", () => {
      dropdown.classList.remove("open");
      if (overlay) {
        renderLiveCamsList();
        overlay.style.display = "flex";
        document.body.style.overflow = "hidden";
      }
    });
  }

  if (closeBtn && overlay) {
    closeBtn.addEventListener("click", () => {
      overlay.style.display = "none";
      document.body.style.overflow = "";
    });
  }
}

function updateLiveCountUI(n) {
  const badge = document.getElementById("live-count-badge");
  const eventsEl = document.getElementById("live-count-events");
  const chatEl = document.getElementById("live-count-chat");
  const text = n > 0 ? n + " live" : "— live";
  if (badge) badge.textContent = text;
  if (eventsEl) eventsEl.textContent = "· " + text;
  if (chatEl) chatEl.textContent = "· " + text;
}

function initLiveCount() {
  // Base: random 9–15. Each person online adds +1.
  liveCountBase = Math.floor(Math.random() * 7) + 9;
  liveCount = liveCountBase + 1; // current user
  updateLiveCountUI(liveCount);

  if (useSupabase && sb) {
    try {
      presenceChannel = sb.channel("picklerally-online");
      presenceChannel
        .on("presence", { event: "sync" }, () => {
          const state = presenceChannel.presenceState();
          const onlineCount = Object.values(state).reduce((sum, arr) => sum + (arr?.length || 0), 0);
          liveCount = liveCountBase + onlineCount;
          updateLiveCountUI(liveCount);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await presenceChannel.track({ joined_at: new Date().toISOString() });
            const state = presenceChannel.presenceState();
            const onlineCount = Object.values(state).reduce((sum, arr) => sum + (arr?.length || 0), 0);
            liveCount = liveCountBase + onlineCount;
            updateLiveCountUI(liveCount);
          }
        });
    } catch (e) {
      console.warn("Supabase presence not available, using default live count:", e.message);
    }
  }
}

async function runDiagnostics() {
  const checks = [];

  checks.push({
    name: "Supabase configured",
    ok: typeof SUPABASE_URL !== "undefined" && SUPABASE_URL !== "YOUR_SUPABASE_URL",
  });

  checks.push({
    name: "Events loaded",
    ok: Array.isArray(events) && events.length > 0,
  });

  checks.push({
    name: "Players loaded",
    ok: Array.isArray(players) && players.length > 0,
  });

  const navItems = document.querySelectorAll(".nav-item");
  checks.push({
    name: "Bottom nav present",
    ok: navItems.length >= 3,
  });

  // Extra Supabase / schema checks
  if (useSupabase && sb) {
    if (USE_SUPABASE_DATA) {
      try {
        const { error: eventsErr } = await sb.from("events").select("id").limit(1);
        checks.push({
          name: "DB query — events table",
          ok: !eventsErr,
        });
      } catch (e) {
        checks.push({
          name: "DB query — events table",
          ok: false,
        });
      }

      try {
        const { error: locErr } = await sb.from("events").select("lat,lng").limit(1);
        checks.push({
          name: "Events lat/lng columns",
          ok: !locErr,
        });
      } catch (e) {
        checks.push({
          name: "Events lat/lng columns",
          ok: false,
        });
      }
    }

    if (USE_SUPABASE_CHAT) {
      try {
        const { error: chatRoomsErr } = await sb.from("chat_rooms").select("id").limit(1);
        checks.push({
          name: "Chat rooms table",
          ok: !chatRoomsErr,
        });
      } catch (e) {
        checks.push({
          name: "Chat rooms table",
          ok: false,
        });
      }

      try {
        const { error: msgErr } = await sb.from("messages").select("id").limit(1);
        checks.push({
          name: "Messages table",
          ok: !msgErr,
        });
      } catch (e) {
        checks.push({
          name: "Messages table",
          ok: false,
        });
      }
    }
  }

  // Browser location / geolocation
  try {
    const loc = await getUserLocation();
    checks.push({
      name: "Browser location available",
      ok: !!loc,
    });
  } catch (_e) {
    checks.push({
      name: "Browser location available",
      ok: false,
    });
  }

  const messages = checks.map(c => `${c.ok ? "✅" : "❌"} ${c.name}`);

  // Very lightweight “agentic” helper: summarize likely root cause
  let summary = "";
  const hasSupabase = checks.find(c => c.name === "Supabase configured")?.ok;
  const eventsLoaded = checks.find(c => c.name === "Events loaded")?.ok;
  const playersLoaded = checks.find(c => c.name === "Players loaded")?.ok;
  const navPresent = checks.find(c => c.name === "Bottom nav present")?.ok;

  if (!navPresent) {
    summary = "UI shell is missing bottom navigation; verify you are opening index.html and not another page.";
  } else if (!eventsLoaded && !playersLoaded) {
    summary = "Events and players failed to load; this is usually a JavaScript error during init or a missing DOM container.";
  } else if (!hasSupabase) {
    summary = "Supabase is not configured; core UI should still work using local mock data, but auth/chat will be disabled.";
  }

  const summaryLine = summary ? `\n\nHelper hint:\n• ${summary}` : "";

  // eslint-disable-next-line no-alert
  alert("Diagnostics:\n\n" + messages.join("\n") + summaryLine);
}

function initFab() {
  const fab = document.getElementById("create-event-btn");
  if (fab) fab.addEventListener("click", openAddEventForm);

  const addBtn = document.getElementById("events-add-btn");
  if (addBtn) addBtn.addEventListener("click", openAddEventForm);

  const eventListEl = document.getElementById("event-list");
  if (eventListEl) {
    eventListEl.addEventListener("click", async (e) => {
    const joinBtn = e.target.closest(".event-join");
    const card = e.target.closest(".event-card");
    if (!card) return;

    const id = card.dataset.id;

    if (joinBtn) {
      e.preventDefault();
      if (!id) return;
      if (joinedEvents.has(id)) {
        joinedEvents.delete(id);
        updateEventSpots(id, +1);
      } else {
        joinedEvents.add(id);
        updateEventSpots(id, -1);
        alert("You have joined this event (local only for now).");
      }
      // Re-render list so spots and button label stay in sync
      renderEvents();
      return;
    }

    // Click on card opens detail sheet
    openEventDetail(id);
    });
  }

  const playerListEl = document.getElementById("player-list");
  if (playerListEl) {
    playerListEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".player-action");
      if (!btn) return;
      e.preventDefault();
      const card = btn.closest(".player-card");
      const id = card?.dataset.id;
      const name = card?.querySelector("h3")?.textContent || "Player";
      if (!id) return;

      if (playerRequests.has(id)) {
        // Already sent; do nothing or show info
        alert(`You already sent a request to ${name}.`);
        return;
      }

      playerRequests.add(id);
      btn.textContent = "✓";
      btn.classList.add("player-action-sent");
      alert(`Request sent to ${name}. (Local only for now)`);
    });
  }
}

// Auto-init only in the real browser app, not in Jest tests
const isJestEnv =
  typeof process !== "undefined" &&
  process.env &&
  typeof process.env.JEST_WORKER_ID !== "undefined";

if (!isJestEnv) {
  try {
    init();
  } catch (err) {
    console.error("App init error:", err);
    const list = document.getElementById("event-list");
    if (list) {
      list.innerHTML =
        '<p class="empty">Failed to load. Check console. <br><small>Ensure you run via a local server (npx serve .)</small></p>';
    }
  }
}

// Export helpers for unit tests (Node/Jest)
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    getDistance,
    typeLabel,
    spotsLabel,
    escapeHtml,
    renderEvents,
    renderPlayers,
    initAuth,
    updateChatAuthState,
    __setEventsForTest,
    __setPlayersForTest,
  };
}
