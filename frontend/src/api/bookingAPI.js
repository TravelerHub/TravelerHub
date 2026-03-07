// src/api/bookingApi.js
// Assumes you already have a `request` helper similar to your chatApi usage.
// Example request helper signature: request(url, { method, body })

import { request } from "./request";

export const bookingApi = {
  list: ({ tripId }) =>
    request(`/api/bookings?tripId=${encodeURIComponent(tripId)}`),

  get: (bookingId) =>
    request(`/api/bookings/${encodeURIComponent(bookingId)}`),

  create: (payload) =>
    request(`/api/bookings`, { method: "POST", body: payload }),

  update: (bookingId, payload) =>
    request(`/api/bookings/${encodeURIComponent(bookingId)}`, {
      method: "PATCH",
      body: payload,
    }),

  cancel: (bookingId, payload = {}) =>
    request(`/api/bookings/${encodeURIComponent(bookingId)}/cancel`, {
      method: "POST",
      body: payload, // e.g. { reason: "..." }
    }),

  remove: (bookingId) =>
    request(`/api/bookings/${encodeURIComponent(bookingId)}`, {
      method: "DELETE",
    }),
};
