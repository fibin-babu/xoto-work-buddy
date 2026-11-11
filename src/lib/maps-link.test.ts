import { describe, expect, it } from "vitest";
import { isGoogleMapsHost, isShortMapsLink, parseMapsLink } from "./maps-link";

describe("parseMapsLink", () => {
  it("prefers the exact pin over the camera position and keeps the place name", () => {
    const url = "https://www.google.com/maps/place/Burj+Khalifa/@25.1971,55.2741,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d25.197197!4d55.2743764!16s";
    expect(parseMapsLink(url)).toEqual({ lat: 25.197197, lng: 55.2743764, name: "Burj Khalifa" });
  });

  it("decodes encoded place names", () => {
    const url = "https://www.google.com/maps/place/Dubai+Mall%2C+Downtown/@25.1985,55.2796,17z";
    expect(parseMapsLink(url)).toEqual({ lat: 25.1985, lng: 55.2796, name: "Dubai Mall, Downtown" });
  });

  it("strips invisible direction marks from Arabic names", () => {
    const url = "https://www.google.com/maps/place/%D8%A8%D8%B1%D8%AC+%D8%AE%D9%84%D9%8A%D9%81%D8%A9%E2%80%AD/@25.197197,55.2743764,17z/data=!3m1!4b1!4m6!3m5!1s0x3e5f43348a67e24b:0xff45e502e1ceb7e2!8m2!3d25.197197!4d55.2743764!16zL20vMDNjbjB2?entry=ttu";
    expect(parseMapsLink(url)).toEqual({ lat: 25.197197, lng: 55.2743764, name: "برج خليفة" });
  });

  it("reads coordinates from query parameters", () => {
    expect(parseMapsLink("https://maps.google.com/?q=25.2048,55.2708")).toEqual({ lat: 25.2048, lng: 55.2708, name: null });
    expect(parseMapsLink("https://www.google.com/maps/search/?api=1&query=25.2,55.3")).toEqual({ lat: 25.2, lng: 55.3, name: null });
  });

  it("reads a dropped pin whose place segment is the coordinates", () => {
    expect(parseMapsLink("https://www.google.com/maps/place/25.2048,55.2708/@25.2,55.27,15z")).toEqual({ lat: 25.2048, lng: 55.2708, name: null });
  });

  it("accepts a plain lat, lng pair", () => {
    expect(parseMapsLink(" 25.2048, 55.2708 ")).toEqual({ lat: 25.2048, lng: 55.2708, name: null });
  });

  it("rejects non-Google links, out-of-range and missing coordinates", () => {
    expect(parseMapsLink("https://evil.example/maps/@25.2,55.2,15z")).toBeNull();
    expect(parseMapsLink("95, 55")).toBeNull();
    expect(parseMapsLink("https://www.google.com/maps/search/coffee")).toBeNull();
    expect(parseMapsLink("not a link")).toBeNull();
  });
});

describe("Google Maps hosts", () => {
  it("allows only Google Maps and short-link hosts", () => {
    expect(isGoogleMapsHost("www.google.com")).toBe(true);
    expect(isGoogleMapsHost("maps.google.ae")).toBe(true);
    expect(isGoogleMapsHost("www.google.co.uk")).toBe(true);
    expect(isGoogleMapsHost("maps.app.goo.gl")).toBe(true);
    expect(isGoogleMapsHost("google.com.evil.example")).toBe(false);
    expect(isGoogleMapsHost("notgoogle.com")).toBe(false);
  });

  it("recognises short share links", () => {
    expect(isShortMapsLink(new URL("https://maps.app.goo.gl/abc123"))).toBe(true);
    expect(isShortMapsLink(new URL("https://goo.gl/maps/abc123"))).toBe(true);
    expect(isShortMapsLink(new URL("https://www.google.com/maps/@1,2,3z"))).toBe(false);
  });
});
