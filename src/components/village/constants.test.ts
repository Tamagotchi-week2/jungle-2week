import { describe, expect, it } from "vitest";

import {
  blockedZones,
  interactionZones,
  isPixelBlocked,
  isPixelCircleBlocked,
  isPixelWithinInteractionZone,
  MAP_IMAGE_HEIGHT,
  MAP_IMAGE_WIDTH,
} from "./constants";

describe("village collision and interaction zones", () => {
  it("registers object collision zones and blocks obstructed pixels", () => {
    expect(blockedZones.length).toBeGreaterThan(0);
    // Upper boundary tree line
    expect(isPixelBlocked(300, 45)).toBe(true);
    // House body
    expect(isPixelCircleBlocked(200, 100, 20)).toBe(true);
    // Pond water area
    expect(isPixelCircleBlocked(1370, 700, 20)).toBe(true);
  });

  it("registers interaction zones for all 5 facilities", () => {
    expect(interactionZones).toHaveLength(5);

    const houseZone = interactionZones.find((z) => z.type === "house")!;
    const mailboxZone = interactionZones.find((z) => z.type === "mailbox")!;
    const farmZone = interactionZones.find((z) => z.type === "farm")!;
    const mineZone = interactionZones.find((z) => z.type === "mine")!;
    const shoreZone = interactionZones.find((z) => z.type === "shore")!;

    expect(houseZone).toBeDefined();
    expect(mailboxZone).toBeDefined();
    expect(farmZone).toBeDefined();
    expect(mineZone).toBeDefined();
    expect(shoreZone).toBeDefined();

    // Verify coordinates within interaction zones
    expect(isPixelWithinInteractionZone(235, 165, houseZone)).toBe(true);
    expect(isPixelWithinInteractionZone(365, 175, mailboxZone)).toBe(true);
    expect(isPixelWithinInteractionZone(724, 300, farmZone)).toBe(true);
    expect(isPixelWithinInteractionZone(145, 610, mineZone)).toBe(true);
    expect(isPixelWithinInteractionZone(1100, 750, shoreZone)).toBe(true);
  });

  it("handles map boundaries correctly", () => {
    expect(isPixelCircleBlocked(20, 20, 30)).toBe(true);
    // Open path at bottom center
    expect(isPixelCircleBlocked(724, 938, 20)).toBe(false);
  });
});
