/**
 * Admin API Client
 *
 * All admin endpoints are protected by Auth0 JWT verification on the backend.
 * This client assumes the frontend has obtained a valid access token via Auth0
 * and includes it in the Authorization header.
 */

import axios, { AxiosInstance } from "axios";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export interface Package {
  id: string;
  shipment_id: string;
  description: string;
  weight_kg: string;
  declared_value: string;
}

export interface Shipment {
  id: string;
  customer_id: string;
  tracking_number: string;
  status:
    | "label_created"
    | "in_transit"
    | "out_for_delivery"
    | "delivered"
    | "exception";
  carrier: string;
  origin: string;
  destination: string;
  estimated_delivery: string | null;
  last_update: string;
  deleted_at: string | null;
  packages: Package[];
}

export interface ShipmentListResponse {
  shipments: Shipment[];
  total: number;
  page: number;
  page_size: number;
}

export interface CreateShipmentRequest {
  customer_id: string;
  tracking_number: string;
  status?:
    | "label_created"
    | "in_transit"
    | "out_for_delivery"
    | "delivered"
    | "exception";
  carrier: string;
  origin: string;
  destination: string;
  estimated_delivery?: string;
}

export interface UpdateShipmentRequest {
  status?:
    | "label_created"
    | "in_transit"
    | "out_for_delivery"
    | "delivered"
    | "exception";
  carrier?: string;
  origin?: string;
  destination?: string;
  estimated_delivery?: string;
}

export interface CreatePackageRequest {
  shipment_id: string;
  description: string;
  weight_kg: number;
  declared_value: number;
}

export interface DashboardStats {
  total_shipments: number;
  by_status: Record<string, number>;
  recent_shipments: Shipment[];
}

/**
 * Admin API Client with Auth0 token support
 */
export class AdminApiClient {
  private client: AxiosInstance;
  private accessToken: string | null = null;

  constructor(baseURL: string = BACKEND_URL) {
    this.client = axios.create({
      baseURL,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Interceptor to add Authorization header if token is set
    this.client.interceptors.request.use((config) => {
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`;
      }
      return config;
    });
  }

  /**
   * Set the Auth0 access token for subsequent requests
   */
  setAccessToken(token: string) {
    this.accessToken = token;
  }

  /**
   * List shipments with optional filters
   */
  async listShipments(params?: {
    status?: string;
    customer_id?: string;
    tracking_number?: string;
    include_deleted?: boolean;
    page?: number;
    page_size?: number;
  }): Promise<ShipmentListResponse> {
    const response = await this.client.get<ShipmentListResponse>(
      "/admin/shipments",
      { params },
    );
    return response.data;
  }

  /**
   * Create a new shipment
   */
  async createShipment(data: CreateShipmentRequest): Promise<Shipment> {
    const response = await this.client.post<Shipment>("/admin/shipments", data);
    return response.data;
  }

  /**
   * Update an existing shipment
   */
  async updateShipment(
    id: string,
    data: UpdateShipmentRequest,
  ): Promise<Shipment> {
    const response = await this.client.put<Shipment>(
      `/admin/shipments/${id}`,
      data,
    );
    return response.data;
  }

  /**
   * Soft-delete a shipment
   */
  async deleteShipment(id: string): Promise<void> {
    await this.client.delete(`/admin/shipments/${id}`);
  }

  /**
   * Add a package to a shipment
   */
  async createPackage(data: CreatePackageRequest): Promise<Package> {
    const response = await this.client.post<Package>("/admin/packages", data);
    return response.data;
  }

  /**
   * Get dashboard summary statistics
   */
  async getDashboardStats(): Promise<DashboardStats> {
    const response = await this.client.get<DashboardStats>("/admin/dashboard");
    return response.data;
  }
}

/**
 * Default admin API client instance
 *
 * Note: You must call setAccessToken() after obtaining an Auth0 access token
 * before making any requests.
 */
export const adminApi = new AdminApiClient();
