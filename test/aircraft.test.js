const test = require("node:test");
const assert = require("node:assert/strict");
const Craft = require("../lib/aircraft");

test("type codes become readable names and silhouettes", () => {
  const id = Craft.identify({ icao24: "4b1814", callsign: "SWR18A" }, { icaoType: "BCS3", operator: "Swiss International Air Lines" });
  assert.equal(id.typeName, "Airbus A220-300");
  assert.equal(id.shape, "narrow");
  assert.equal(id.airline, "SWISS"); // curated short name wins over the long operator name
});

test("unknown types fall back to the operator and the callsign", () => {
  const id = Craft.identify({ icao24: "abc123", callsign: "CSW615", v: 200, alt: 9000 }, { flight: "615", operator: "Worldwide Air Charter Systems" });
  assert.equal(id.typeName, null);
  assert.equal(id.airline, "Worldwide Air Charter Systems");
  assert.equal(id.flight, "CSW615"); // "615" is not a flight number
});

test("short type names drop the maker unless only a number is left", () => {
  assert.deepEqual(["Airbus A321neo", "Boeing 737-800", "Embraer E195", "Cessna 172"].map(Craft.shortType), ["A321neo", "737-800", "E195", "Cessna 172"]);
});

test("silhouette ids are prefixed per widget", () => {
  assert.match(Craft.silhouetteDefs("x1-sil"), /id="x1-sil-narrow"/);
});
