import { describe, expect, it } from "vitest";
import { extractVehiclesFromSearchHtml } from "../lib/providers/search-html";

describe("extractVehiclesFromSearchHtml", () => {
  it("extracts IAAI listing links from rendered search HTML", () => {
    const html = `
      <article>
        <a href="/VehicleDetail/45433626~US" aria-label="image"></a>
        <h4>
          <a href="/VehicleDetail/45433626~US" name="45433626" id="a+45433626">
            2025 HYUNDAI SANTA FE HYBRID CALLIGRAPHY
          </a>
        </h4>
      </article>
      <article>
        <a href="/VehicleDetail/45586439~US" name="45586439">
          2024 HYUNDAI SANTA FE CALLIGRAPHY
        </a>
      </article>
    `;

    const vehicles = extractVehiclesFromSearchHtml(
      "iaai",
      html,
      "https://www.iaai.com/Search?Keyword=hyundai%20santa%20fe%20calligraphy",
      200,
    );

    expect(vehicles).toHaveLength(2);
    expect(vehicles[0]).toMatchObject({
      id: "iaai:stock:45433626",
      stockNumber: "45433626",
      title: "2025 HYUNDAI SANTA FE HYBRID CALLIGRAPHY",
      url: "https://www.iaai.com/VehicleDetail/45433626~US",
      imageUrl:
        "https://vis.iaai.com/resizer?imageKeys=45433626~SID~I1&width=640&height=480",
    });
  });

  it("deduplicates repeated result links and respects the limit", () => {
    const html = `
      <a href="/VehicleDetail/45433626~US" aria-label="image"></a>
      <a href="/VehicleDetail/45433626~US" name="45433626">
        2025 HYUNDAI SANTA FE HYBRID CALLIGRAPHY
      </a>
      <a href="/VehicleDetail/45586439~US" name="45586439">
        2024 HYUNDAI SANTA FE CALLIGRAPHY
      </a>
    `;

    const vehicles = extractVehiclesFromSearchHtml(
      "iaai",
      html,
      "https://www.iaai.com/Search",
      1,
    );

    expect(vehicles.map((vehicle) => vehicle.stockNumber)).toEqual(["45433626"]);
  });

  it("extracts Copart lot links from rendered search HTML", () => {
    const html = `
      <a href="/vehicleFinder">Vehicle Finder</a>
      <a href="/lot/97875625/2025-hyundai-santa-fe-hybrid-calligraphy-ca-fresno">
        2025 HYUNDAI SANTA FE HYBRID CALLIGRAPHY
      </a>
      <a href="/lot/97875625/2025-hyundai-santa-fe-hybrid-calligraphy-ca-fresno">
        97875625
      </a>
    `;

    const vehicles = extractVehiclesFromSearchHtml(
      "copart",
      html,
      "https://www.copart.com/lotSearchResults",
      200,
    );

    expect(vehicles).toHaveLength(1);
    expect(vehicles[0]).toMatchObject({
      id: "copart:lot:97875625",
      lotNumber: "97875625",
      title: "2025 HYUNDAI SANTA FE HYBRID CALLIGRAPHY",
      url: "https://www.copart.com/lot/97875625/2025-hyundai-santa-fe-hybrid-calligraphy-ca-fresno",
    });
    expect(vehicles[0].imageUrl).toBeUndefined();
  });
});
