/**
 * Helpers for deciding which shipment cards to show in chat.
 *
 * Prefer single-shipment tool metadata (`get_shipment_status`). When metadata
 * still has multiple shipments, filter to the one tracking mentioned in text.
 */

import type { ShipmentPayload } from "@/lib/api";

const TRACKING_PATTERNS: RegExp[] = [
  /\b([A-Z]{2,}(?:-[A-Z0-9]{2,})+)\b/g, // ADMIN-TEST-001
  /\b([A-Z]{2}\d{10,})\b/g, // SS2608000057
  /\b(1Z[0-9A-Z]{16})\b/g, // UPS
  /\b(\d{12,})\b/g, // FedEx/USPS numeric
];

function isValidTrackingCandidate(candidate: string): boolean {
  if (candidate.length < 8) {
    return false;
  }
  // Hyphenated tokens must include a digit (avoid phrase fragments)
  if (candidate.includes("-") && !/\d/.test(candidate)) {
    return false;
  }
  return true;
}

/**
 * Extract unique tracking-like tokens from free text (same patterns as backend).
 */
export function extractTrackingNumbers(text: string): string[] {
  const cleaned = text.toUpperCase().replace(/[^\w\s-]/g, "");
  const found: string[] = [];
  const seen = new Set<string>();

  for (const pattern of TRACKING_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(cleaned)) !== null) {
      const candidate = match[1];
      if (!isValidTrackingCandidate(candidate) || seen.has(candidate)) {
        continue;
      }
      seen.add(candidate);
      found.push(candidate);
    }
  }

  return found;
}

export interface ShipmentCardFilterInput {
  shipments: ShipmentPayload[];
  /** Tool name from stream metadata, e.g. get_shipment_status | lookup_shipments */
  tool?: string;
  userText?: string;
  assistantText?: string;
}

export interface ShipmentCardFilterResult {
  visible: ShipmentPayload[];
  /** True when visible is a subset of shipments (UI should offer Show all). */
  isFiltered: boolean;
  total: number;
}

/**
 * Decide which shipment cards to render for a bot turn.
 *
 * Rules:
 * - 0–1 shipments → show as-is
 * - Exactly one tracking mentioned in user+assistant text that matches a card → show that card
 * - Prefer this path when tool is `get_shipment_status` (same filter, explicit preference)
 * - 0 or 2+ matching mentions → show all
 */
export function filterShipmentsForDisplay(
  input: ShipmentCardFilterInput,
): ShipmentCardFilterResult {
  const { shipments, userText = "", assistantText = "" } = input;
  const total = shipments.length;

  if (total <= 1) {
    return { visible: shipments, isFiltered: false, total };
  }

  const byTracking = new Map(
    shipments.map((s) => [s.tracking_number.toUpperCase(), s]),
  );

  const mentioned = extractTrackingNumbers(`${userText} ${assistantText}`);
  const matched = mentioned.filter((t) => byTracking.has(t));

  if (matched.length === 1) {
    const one = byTracking.get(matched[0])!;
    return { visible: [one], isFiltered: true, total };
  }

  return { visible: shipments, isFiltered: false, total };
}
