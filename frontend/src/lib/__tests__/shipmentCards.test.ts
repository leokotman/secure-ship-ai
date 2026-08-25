import type { ShipmentPayload } from "@/lib/api";
import {
  extractTrackingNumbers,
  filterShipmentsForDisplay,
} from "@/lib/shipmentCards";

function makeShipment(
  tracking_number: string,
  id = tracking_number,
): ShipmentPayload {
  return {
    id,
    tracking_number,
    status: "in_transit",
    carrier: "SecureShip",
    origin: "A",
    destination: "B",
    estimated_delivery: null,
    last_update: null,
    packages: [],
  };
}

describe("extractTrackingNumbers", () => {
  it("extracts hyphenated admin-style codes", () => {
    expect(extractTrackingNumbers("Tell me about ADMIN-TEST-002")).toEqual([
      "ADMIN-TEST-002",
    ]);
  });

  it("extracts multiple trackings", () => {
    expect(
      extractTrackingNumbers("Compare ADMIN-TEST-001 and ADMIN-TEST-002"),
    ).toEqual(["ADMIN-TEST-001", "ADMIN-TEST-002"]);
  });

  it("ignores short tokens and hyphenated words without digits", () => {
    expect(extractTrackingNumbers("SHOW-ALL shipments please")).toEqual([]);
  });
});

describe("filterShipmentsForDisplay", () => {
  const shipments = [
    makeShipment("ADMIN-TEST-001", "s1"),
    makeShipment("ADMIN-TEST-002", "s2"),
    makeShipment("ADMIN-TEST-003", "s3"),
  ];

  it("returns all when only one shipment is present", () => {
    const one = [shipments[0]];
    expect(
      filterShipmentsForDisplay({
        shipments: one,
        userText: "Tell me about ADMIN-TEST-001",
      }),
    ).toEqual({ visible: one, isFiltered: false, total: 1 });
  });

  it("filters to the single mentioned tracking among many", () => {
    const result = filterShipmentsForDisplay({
      shipments,
      tool: "lookup_shipments",
      userText: "Tell me about ADMIN-TEST-002",
      assistantText: "Here is ADMIN-TEST-002 status.",
    });
    expect(result.isFiltered).toBe(true);
    expect(result.total).toBe(3);
    expect(result.visible).toHaveLength(1);
    expect(result.visible[0].tracking_number).toBe("ADMIN-TEST-002");
  });

  it("prefers get_shipment_status path when one tracking is mentioned", () => {
    const result = filterShipmentsForDisplay({
      shipments,
      tool: "get_shipment_status",
      userText: "Status of ADMIN-TEST-001?",
      assistantText: "ADMIN-TEST-001 is in transit.",
    });
    expect(result.visible.map((s) => s.tracking_number)).toEqual([
      "ADMIN-TEST-001",
    ]);
    expect(result.isFiltered).toBe(true);
  });

  it("shows all when zero trackings are mentioned", () => {
    const result = filterShipmentsForDisplay({
      shipments,
      userText: "Show me all my orders",
      assistantText: "Here are your shipments.",
    });
    expect(result.isFiltered).toBe(false);
    expect(result.visible).toHaveLength(3);
  });

  it("shows all when two or more trackings are mentioned", () => {
    const result = filterShipmentsForDisplay({
      shipments,
      userText: "Compare ADMIN-TEST-001 and ADMIN-TEST-002",
      assistantText: "Both ADMIN-TEST-001 and ADMIN-TEST-002 are moving.",
    });
    expect(result.isFiltered).toBe(false);
    expect(result.visible).toHaveLength(3);
  });

  it("ignores mentioned trackings that are not in the shipment list", () => {
    const result = filterShipmentsForDisplay({
      shipments,
      userText: "What about NONEXISTENT-999?",
      assistantText: "I could not find NONEXISTENT-999.",
    });
    expect(result.isFiltered).toBe(false);
    expect(result.visible).toHaveLength(3);
  });
});
