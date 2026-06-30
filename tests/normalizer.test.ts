import { describe, expect, it } from "vitest";
import { normalizeVehicle } from "../lib/providers/shared";

describe("normalizeVehicle", () => {
  it("normalizes Copart actor records", () => {
    const vehicle = normalizeVehicle("copart", {
      imageUrl: "https://cs.copart.com/example.jpg",
      lot_number: "99111625",
      year: 2024,
      make: "HYUNDAI",
      model: "SANTA FE",
      trim: "CALLIGRAPHY",
      vin: "5NMP5DGL0RH000000",
      item_url:
        "https://www.copart.com/lot/99111625/2024-hyundai-santa-fe-calligraphy-mi-detroit",
      sale_status: "CURRENT",
      current_bid: 7200,
      buy_it_now_price: 9500,
      auction_date: "2026-07-01T15:00:00.000Z",
      sale_location: "MI - DETROIT",
      primary_damage: "FRONT END",
      odometer: 23870,
      odometer_unit: "MI",
    });

    expect(vehicle).toMatchObject({
      id: "copart:lot:99111625",
      source: "copart",
      lotNumber: "99111625",
      year: 2024,
      make: "HYUNDAI",
      model: "SANTA FE",
      trim: "CALLIGRAPHY",
      title: "2024 HYUNDAI SANTA FE CALLIGRAPHY",
      currentBid: "7200",
      buyNowPrice: "9500",
      location: "MI - DETROIT",
      damage: "FRONT END",
      odometer: "23870 MI",
      url: "https://www.copart.com/lot/99111625/2024-hyundai-santa-fe-calligraphy-mi-detroit",
      imageUrl: "https://cs.copart.com/example.jpg",
    });
  });

  it("normalizes IAAI actor records", () => {
    const vehicle = normalizeVehicle("iaai", {
      title: "2024 HYUNDAI SANTA FE CALLIGRAPHY",
      detail_url: "https://www.iaai.com/VehicleDetail/45161509~US",
      id: "45161509",
      "Stock #": "63106399",
      "Primary Damage": "Front End",
      Odometer: "23,870 mi",
      Branch: "Long Island",
      ACV: "$32,800",
    });

    expect(vehicle).toMatchObject({
      id: "iaai:stock:63106399",
      source: "iaai",
      stockNumber: "63106399",
      year: 2024,
      title: "2024 HYUNDAI SANTA FE CALLIGRAPHY",
      url: "https://www.iaai.com/VehicleDetail/45161509~US",
      damage: "Front End",
      odometer: "23,870 mi",
      location: "Long Island",
    });
  });
});
