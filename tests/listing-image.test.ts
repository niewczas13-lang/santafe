import { describe, expect, it } from "vitest";
import {
  extractListingDetailsFromHtml,
  extractListingImageUrl,
} from "../lib/listing-image";

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

  it("extracts IAAI details from ProductDetailsVM JSON", () => {
    const details = extractListingDetailsFromHtml(
      `
        <script type="application/json" id="ProductDetailsVM">
          {
            "inventoryView": {
              "attributes": {
                "StartsDesc": "Stationary",
                "RunAndDrive": "False",
                "EngineSize": "1.6L I-4 DI, DOHC, VVT, TURBO, 178HP",
                "ExteriorColor": "BLACK",
                "InteriorColor": "Brown"
              },
              "imageDimensions": {
                "keys": {
                  "$values": [
                    { "k": "44704880~SID~B613~S0~I1~RW2576~H1932~TH0" }
                  ]
                }
              }
            }
          }
        </script>
      `,
      "https://www.iaai.com/VehicleDetail/44704880~US",
    );

    expect(details).toEqual({
      engine: "1.6L I-4 DI, DOHC, VVT, TURBO, 178HP",
      exteriorColor: "BLACK",
      imageUrl:
        "https://vis.iaai.com/resizer?imageKeys=44704880~SID~B613~S0~I1~RW2576~H1932~TH0&width=640&height=480",
      interiorColor: "Brown",
      runStatus: "stationary",
    });
  });
});
