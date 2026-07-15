/**
 * Smoke test: verifies Google OAuth credentials are present and structurally valid.
 * Does NOT make a real network call — just checks env vars are set and well-formed.
 */
import { describe, it, expect } from "vitest";

describe("Google Calendar secrets", () => {
  it("VITE_GOOGLE_CLIENT_ID is set and looks like a Google client ID", () => {
    const clientId = process.env.VITE_GOOGLE_CLIENT_ID;
    expect(clientId, "VITE_GOOGLE_CLIENT_ID must be set").toBeTruthy();
    // Google client IDs end with .apps.googleusercontent.com
    expect(clientId).toMatch(/\.apps\.googleusercontent\.com$/);
  });

  it("GOOGLE_CLIENT_SECRET is set and non-empty", () => {
    const secret = process.env.GOOGLE_CLIENT_SECRET;
    expect(secret, "GOOGLE_CLIENT_SECRET must be set").toBeTruthy();
    expect(secret!.length).toBeGreaterThan(10);
  });
});
