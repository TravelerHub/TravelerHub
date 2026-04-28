import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../services/api.js";

const FIVE_MIN = 5 * 60 * 1000;

export function useUserTrips(options = {}) {
  return useQuery({
    queryKey: ["my-groups"],
    queryFn: () => apiFetch("/groups/me"),
    staleTime: FIVE_MIN,
    enabled: options.enabled !== false,
    select: (data) => (Array.isArray(data) ? data : []),
  });
}
