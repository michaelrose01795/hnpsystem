import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createPartsOrder: vi.fn(),
  getPartsOrderByNumber: vi.fn(),
  getPartsOrders: vi.fn(),
  updatePartsOrderByNumber: vi.fn(),
}));

vi.mock("@/lib/auth/roleGuard", () => ({
  withRoleGuard: (handler) => handler,
}));

vi.mock("@/lib/database/partsOrders", () => ({
  createPartsOrder: mocks.createPartsOrder,
  getPartsOrderByNumber: mocks.getPartsOrderByNumber,
  getPartsOrders: mocks.getPartsOrders,
  updatePartsOrderByNumber: mocks.updatePartsOrderByNumber,
}));

import { partsOrdersHandler } from "@/pages/api/parts/orders";
import { partsOrderDetailHandler } from "@/pages/api/parts/orders/[orderNumber]";

const createResponse = () => {
  const response = {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader: vi.fn((name, value) => {
      response.headers[name] = value;
    }),
    status: vi.fn((statusCode) => {
      response.statusCode = statusCode;
      return response;
    }),
    json: vi.fn((body) => {
      response.body = body;
      return response;
    }),
  };
  return response;
};

describe("parts orders API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an order through the database helper", async () => {
    const order = { order_number: "P00001", items: [{ part_name: "Filter" }] };
    mocks.createPartsOrder.mockResolvedValue(order);
    const response = createResponse();
    const body = {
      order: { customer_name: "Example Customer" },
      items: [{ part_name: "Filter", quantity: 1 }],
    };

    await partsOrdersHandler({ method: "POST", body }, response);

    expect(mocks.createPartsOrder).toHaveBeenCalledWith(body);
    expect(response.statusCode).toBe(201);
    expect(response.body).toEqual({ success: true, order });
  });

  it("passes stock reservation and open-order filters through the guarded API", async () => {
    const created = { order_number: "P00002" };
    mocks.createPartsOrder.mockResolvedValue(created);
    mocks.getPartsOrders.mockResolvedValue([]);

    const createResponseRecord = createResponse();
    await partsOrdersHandler(
      {
        method: "POST",
        body: { order: { status: "booked" }, items: [], reserveStock: true },
        query: {},
      },
      createResponseRecord
    );
    expect(mocks.createPartsOrder).toHaveBeenCalledWith({
      order: { status: "booked" },
      items: [],
      reserveStock: true,
    });

    const listResponse = createResponse();
    await partsOrdersHandler(
      {
        method: "GET",
        body: null,
        query: { customerId: "customer-1", openOnly: "true", limit: "5" },
      },
      listResponse
    );
    expect(mocks.getPartsOrders).toHaveBeenCalledWith({
      customerId: "customer-1",
      customerName: undefined,
      vehicleReg: undefined,
      openOnly: true,
      limit: "5",
    });
  });

  it("loads one P-number order", async () => {
    const order = { order_number: "P00001" };
    mocks.getPartsOrderByNumber.mockResolvedValue(order);
    const response = createResponse();

    await partsOrderDetailHandler(
      { method: "GET", query: { orderNumber: "P00001" } },
      response
    );

    expect(mocks.getPartsOrderByNumber).toHaveBeenCalledWith("P00001");
    expect(response.body).toEqual({ success: true, order });
  });

  it("updates an order through the helper that synchronises deliveries", async () => {
    const updates = { delivery_status: "dispatched", status: "ready" };
    const order = { order_number: "P00001", ...updates };
    mocks.updatePartsOrderByNumber.mockResolvedValue(order);
    const response = createResponse();

    await partsOrderDetailHandler(
      { method: "PATCH", query: { orderNumber: "P00001" }, body: { updates } },
      response
    );

    expect(mocks.updatePartsOrderByNumber).toHaveBeenCalledWith("P00001", updates);
    expect(response.body).toEqual({ success: true, order });
  });
});
