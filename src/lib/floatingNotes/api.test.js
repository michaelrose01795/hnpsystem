import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  resolveSessionUserId: vi.fn(),
  getFloatingNotesForUser: vi.fn(),
  createFloatingNote: vi.fn(),
  updateFloatingNote: vi.fn(),
  deleteFloatingNote: vi.fn(),
  getFloatingNoteShareOptions: vi.fn(),
  setNoteSharedUsers: vi.fn(),
}));

vi.mock("next-auth/next", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/pages/api/auth/[...nextauth]", () => ({ authOptions: {} }));
vi.mock("@/lib/auth/sessionUserResolver", () => ({
  resolveSessionUserId: mocks.resolveSessionUserId,
}));
vi.mock("@/lib/database/floatingNotes", () => ({
  getFloatingNotesForUser: mocks.getFloatingNotesForUser,
  createFloatingNote: mocks.createFloatingNote,
  updateFloatingNote: mocks.updateFloatingNote,
  deleteFloatingNote: mocks.deleteFloatingNote,
  getFloatingNoteShareOptions: mocks.getFloatingNoteShareOptions,
  setNoteSharedUsers: mocks.setNoteSharedUsers,
}));

import handler from "@/pages/api/floating-notes";
import { ALL_ACCESS_ROLE } from "@/lib/auth/roles";

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

describe("floating notes API identity boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ user: { id: "7" } });
    mocks.resolveSessionUserId.mockResolvedValue(7);
    mocks.createFloatingNote.mockResolvedValue({ success: true, data: { noteId: 43, isGlobal: false } });
    mocks.updateFloatingNote.mockResolvedValue({ success: true, data: { noteId: 42 } });
    mocks.deleteFloatingNote.mockResolvedValue({ success: true });
  });

  it("uses the signed-in user for updates and ignores a supplied owner id", async () => {
    const req = {
      method: "PATCH",
      query: {},
      body: { noteId: 42, userId: 999, title: "Private" },
    };
    const res = createResponse();

    await handler(req, res);

    expect(mocks.updateFloatingNote).toHaveBeenCalledWith(42, 7, { title: "Private" });
    expect(res.statusCode).toBe(200);
  });

  it("uses the signed-in user for deletes", async () => {
    const req = { method: "DELETE", query: { noteId: "42" }, body: { userId: 999 } };
    const res = createResponse();

    await handler(req, res);

    expect(mocks.deleteFloatingNote).toHaveBeenCalledWith(42, 7);
  });

  it("forces every new note to start private", async () => {
    const req = {
      method: "POST",
      query: {},
      body: { title: "Private note", description: "Draft", isGlobal: true, userIds: [8] },
    };
    const res = createResponse();

    await handler(req, res);

    expect(mocks.createFloatingNote).toHaveBeenCalledWith({
      userId: 7,
      title: "Private note",
      description: "Draft",
    });
    expect(res.statusCode).toBe(201);
  });

  it("does not expose the staff notes endpoint to customer sessions", async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: "7", roles: ["Customer"] } });
    const req = { method: "GET", query: {}, body: {} };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(403);
    expect(mocks.resolveSessionUserId).not.toHaveBeenCalled();
    expect(mocks.getFloatingNotesForUser).not.toHaveBeenCalled();
  });

  it("does not mistake the all-access staff session for a customer", async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: "7", roles: [ALL_ACCESS_ROLE] } });
    mocks.getFloatingNotesForUser.mockResolvedValue([]);
    const req = { method: "GET", query: {}, body: {} };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mocks.resolveSessionUserId).toHaveBeenCalled();
    expect(mocks.getFloatingNotesForUser).toHaveBeenCalledWith(7);
  });

  it("rejects unauthenticated requests before any note access", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const req = { method: "GET", query: {}, body: {} };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(mocks.getFloatingNotesForUser).not.toHaveBeenCalled();
  });
});
