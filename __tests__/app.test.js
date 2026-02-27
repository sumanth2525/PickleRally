const { getDistance, typeLabel, spotsLabel, escapeHtml } = require("../app");

describe("getDistance", () => {
  test("returns 0 for identical coordinates", () => {
    const d = getDistance(37.77, -122.41, 37.77, -122.41);
    expect(d).toBeCloseTo(0, 5);
  });

  test("returns a positive distance for different coordinates", () => {
    // Rough distance between San Francisco and Los Angeles in miles
    const d = getDistance(37.7749, -122.4194, 34.0522, -118.2437);
    expect(d).toBeGreaterThan(300);
    expect(d).toBeLessThan(450);
  });
});

describe("typeLabel", () => {
  test("maps known types to friendly labels", () => {
    expect(typeLabel("open")).toBe("Open Play");
    expect(typeLabel("league")).toBe("League");
    expect(typeLabel("tournament")).toBe("Tournament");
  });

  test("falls back to original type when unknown", () => {
    expect(typeLabel("clinic")).toBe("clinic");
  });
});

describe("spotsLabel", () => {
  test("uses explicit spots string when present", () => {
    const e = { spots: "5 spots", max_players: 8 };
    expect(spotsLabel(e)).toBe("5 spots");
  });

  test("falls back to max_players when spots missing", () => {
    const e = { max_players: 12 };
    expect(spotsLabel(e)).toBe("12 spots");
  });

  test("handles missing values safely", () => {
    const e = {};
    expect(spotsLabel(e)).toBe("0 spots");
  });
});

describe("escapeHtml", () => {
  test("escapes HTML special characters", () => {
    const input = `<script>alert("x & y")</script>`;
    const escaped = escapeHtml(input);
    expect(escaped).not.toContain("<script>");
    expect(escaped).toContain("&lt;script&gt;");
    // At minimum, ampersand should be escaped
    expect(escaped).toContain("&amp;");
  });

  test("handles empty and null-ish values", () => {
    expect(escapeHtml("")).toBe("");
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});

