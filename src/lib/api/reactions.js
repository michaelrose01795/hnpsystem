// file location: src/lib/api/reactions.js
import { apiRequest } from "@/lib/api/client";

// Returns { [targetId]: [{ userId, name, emoji }, ...] } for the ids asked for.
export const fetchReactions = (targetType, targetIds = []) =>
  apiRequest("/api/reactions", {
    searchParams: { targetType, targetIds },
  });

// Applies one user's pick. The server decides between added / replaced /
// removed — a user only ever holds one reaction per target.
export const saveReaction = (payload) =>
  apiRequest("/api/reactions", {
    method: "POST",
    body: payload,
  });
