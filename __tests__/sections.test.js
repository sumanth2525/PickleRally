const {
  renderEvents,
  renderPlayers,
  initAuth,
  updateChatAuthState,
  __setEventsForTest,
  __setPlayersForTest,
} = require("../app");

describe("Events section", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="event-list"></div>
    `;
  });

  test("renderEvents outputs cards for provided events", () => {
    const sampleEvents = [
      { id: "1", title: "Morning Open Play", type: "open", date: "Today 8 AM", location: "Court A", max_players: 8, spots: "8 spots" },
      { id: "2", title: "League Night", type: "league", date: "Tonight 6 PM", location: "Court B", max_players: 16, spots: "16 spots" },
    ];
    __setEventsForTest(sampleEvents);

    renderEvents();

    const cards = document.querySelectorAll(".event-card");
    expect(cards.length).toBe(2);
    expect(cards[0].querySelector("h3").textContent).toBe("Morning Open Play");
    expect(cards[1].querySelector("h3").textContent).toBe("League Night");
  });
});

describe("Players section", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="player-list"></div>
    `;
  });

  test("renderPlayers outputs cards for provided players", () => {
    const samplePlayers = [
      { id: "p1", name: "Alex M.", skill: "3.5", location: "Downtown" },
      { id: "p2", name: "Jordan K.", skill: "4.0", location: "Riverside" },
    ];
    __setPlayersForTest(samplePlayers);

    renderPlayers("all");

    const cards = document.querySelectorAll(".player-card");
    expect(cards.length).toBe(2);
    expect(cards[0].querySelector("h3").textContent).toBe("Alex M.");
    expect(cards[1].querySelector("h3").textContent).toBe("Jordan K.");
  });
});

describe("Chat section", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <section id="tab-chat">
        <div id="chat-unauth" class="empty"></div>
        <div id="chat-wrapper" class="chat-wrapper">
          <div id="chat-messages"></div>
          <form id="chat-form">
            <input id="chat-input" />
            <button class="chat-send-btn" type="submit">Send</button>
          </form>
        </div>
      </section>
    `;
  });

  test("updateChatAuthState shows unauth message when not signed in or Supabase disabled", async () => {
    await updateChatAuthState(null);

    const unauth = document.getElementById("chat-unauth");
    const wrapper = document.getElementById("chat-wrapper");

    expect(unauth.style.display).toBe("block");
    expect(wrapper.style.display).toBe("none");
    expect(unauth.textContent).toMatch(/Chat is disabled while Supabase is used only for login./i);
  });
});

describe("Profile section", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <section id="tab-profile">
        <div id="profile-guest" class="profile-auth">
          <p class="auth-hint">Requires Supabase.</p>
          <p id="auth-message" class="auth-message"></p>
          <button id="auth-signin"></button>
          <button id="auth-signup"></button>
        </div>
        <div id="profile-logged" class="profile-actions" style="display:none">
          <p id="profile-email" class="profile-email"></p>
          <button id="auth-signout">Sign Out</button>
          <button id="profile-my-events">My Events</button>
          <button id="profile-notifications">Notifications</button>
        </div>
        <div id="profile-avatar">?</div>
        <h2 id="profile-title">Your Profile</h2>
        <p id="profile-subtitle" class="subtitle">Sign in to join events & find players</p>
      </section>
    `;
  });

  test("initAuth shows configuration hint when Supabase is not available", () => {
    initAuth();

    const hint = document.querySelector(".auth-hint");
    const msg = document.getElementById("auth-message");

    expect(hint.textContent).toMatch(/Supabase/);
    // Error or info message should be set
    expect(msg.textContent).not.toBe("");
  });
}
);

