import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HOTEL_IMAGE_BY_SLUG, resolveHotelImage } from "../hotel-images.ts";

describe("hotel images", () => {
  it("maps verified hotel slugs to saved public photos", () => {
    assert.equal(HOTEL_IMAGE_BY_SLUG["hotel-saint-louis"], "/hotels/Hotel-Saint-Louis-Autograph-Collection.jpg");
    assert.equal(HOTEL_IMAGE_BY_SLUG["hampton-inn-gateway-arch"], "/hotels/Hampton-Inn-St-Louis-Downtown---Exterior.jpg");
    assert.equal(HOTEL_IMAGE_BY_SLUG["21c-museum-hotel"], "/hotels/Museum-Hotel-St-Louis.jpg");
    assert.equal(HOTEL_IMAGE_BY_SLUG["bishops-hyatt-regency"], "/hotels/Hyat-Regency-Saint-Louis-at-The-Arch.jpg");
  });

  it("prefers database image_url over slug fallback", () => {
    assert.equal(
      resolveHotelImage({
        slug: "21c-museum-hotel",
        image_url: "/custom.jpg",
      }),
      "/custom.jpg",
    );
  });

  it("falls back to slug mapping when image_url is empty", () => {
    assert.equal(
      resolveHotelImage({
        slug: "21c-museum-hotel",
        image_url: null,
      }),
      "/hotels/Museum-Hotel-St-Louis.jpg",
    );
  });
});
