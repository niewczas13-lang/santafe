import { describe, expect, it } from "vitest";
import { extractListingImageUrl } from "../lib/listing-image";

describe("extractListingImageUrl", () => {
  it("uses Open Graph image metadata", () => {
    expect(
      extractListingImageUrl(
        '<html><head><meta property="og:image" content="https://vis.iaai.com/main.jpg"></head></html>',
        "https://www.iaai.com/VehicleDetail/123",
      ),
    ).toBe("https://vis.iaai.com/main.jpg");
  });

  it("resolves relative listing image URLs", () => {
    expect(
      extractListingImageUrl(
        '<img class="vehicle-image" src="/photos/front.jpg" />',
        "https://www.copart.com/lot/123",
      ),
    ).toBe("https://www.copart.com/photos/front.jpg");
  });
});
