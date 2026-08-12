import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  boundsCenterDistanceKm,
  parseCoordinate,
  parseMapBounds,
  pointInBounds,
} from "../map-bounds";

const root = process.cwd();
const read = (filePath: string) => fs.readFileSync(path.join(root, filePath), "utf8");

describe("travel hotel inventory map", () => {
  it("parses and filters real WGS84 bounds without inventing pins", () => {
    const bounds = parseMapBounds({ north: 38.64, south: 38.62, east: -90.18, west: -90.21 });
    assert.ok(bounds);
    assert.deepEqual(bounds!.northEast, { lat: 38.64, lng: -90.18 });
    assert.deepEqual(bounds!.southWest, { lat: 38.62, lng: -90.21 });
    assert.equal(
      pointInBounds({ latitude: 38.628607, longitude: -90.191533 }, bounds!),
      true,
    );
    assert.equal(
      pointInBounds({ latitude: 38.65, longitude: -90.191533 }, bounds!),
      false,
    );
    assert.equal(parseCoordinate("38.628607"), 38.628607);
    assert.equal(parseCoordinate(null), null);
    assert.ok(
      boundsCenterDistanceKm({ latitude: 38.628607, longitude: -90.191533 }, bounds!) < 2,
    );
  });

  it("rejects inverted latitude bounds", () => {
    assert.equal(parseMapBounds({ north: 38.62, south: 38.64, east: -90.18, west: -90.21 }), null);
  });

  it("accepts northEast/southWest viewport payloads", () => {
    const bounds = parseMapBounds({
      northEast: { lat: 38.64, lng: -90.18 },
      southWest: { lat: 38.62, lng: -90.21 },
    });
    assert.ok(bounds);
    assert.equal(bounds!.north, 38.64);
    assert.equal(bounds!.south, 38.62);
    assert.equal(bounds!.east, -90.18);
    assert.equal(bounds!.west, -90.21);
  });

  it("wires Leaflet map, bounds API, and coordinate metadata end-to-end", () => {
    const page = read("app/travel/hotels/page.tsx");
    const client = read("components/travel/HotelSearchClient.tsx");
    const map = read("components/travel/hotels-map/HotelsInventoryMap.tsx");
    const officialApi = read("app/api/travel/hotels/map/route.ts");
    const marketplaceApi = read("app/api/travel/marketplace/hotels/search/route.ts");
    const marketplaceSearch = read("lib/travel/marketplace/search.ts");
    const types = read("lib/travel/types.ts");
    const pinTypes = read("components/travel/hotels-map/types.ts");
    const migration = read("supabase/migrations/20260811120000_travel_hotels_coordinates.sql");
    const expedia = read("lib/travel/marketplace/expedia-rapid.ts");
    const amadeus = read("lib/travel/marketplace/amadeus.ts");
    const css = read("app/travel/travel-home.css");

    assert.match(page, /HotelSearchClient/);
    assert.match(client, /HotelsInventoryMap/);
    assert.match(client, /\/api\/travel\/hotels\/map/);
    assert.match(client, /\/api\/travel\/marketplace\/hotels\/search/);
    assert.match(client, /northEast/);
    assert.match(client, /southWest/);
    assert.match(client, /LOADING|MapGridSkeleton/);
    assert.match(client, /EMPTY/);
    assert.match(client, /ERROR/);
    assert.match(client, /map_url|mapUrl/);
    assert.match(map, /react-leaflet/);
    assert.match(map, /moveend/);
    assert.match(map, /zoomend/);
    assert.match(map, /northEast|normalizeMapBounds/);
    assert.match(map, /tileerror/);
    assert.match(map, /profileHref|View hotel details/);
    assert.match(officialApi, /publishedHotelsInBounds/);
    assert.match(marketplaceApi, /bounds/);
    assert.match(marketplaceSearch, /filterHotelOffersByBounds|pointInBounds/);
    assert.match(types, /latitude:\s*number\s*\|\s*null/);
    assert.match(types, /longitude:\s*number\s*\|\s*null/);
    assert.match(types, /map_url/);
    assert.match(pinTypes, /source:\s*HotelMapPinSource/);
    assert.match(pinTypes, /northEast/);
    assert.match(css, /ct-hotel-explorer__map-pane/);
    assert.match(css, /position:\s*sticky/);
    assert.match(migration, /38\.628607/);
    assert.match(migration, /-90\.191533/);
    assert.match(expedia, /latitude:/);
    assert.match(expedia, /longitude:/);
    assert.match(amadeus, /geoCode/);
    assert.doesNotMatch(map, /fake pin|mock map|demo coordinate/i);
    assert.doesNotMatch(client, /fake pin|mock map|demo coordinate/i);
  });
});
