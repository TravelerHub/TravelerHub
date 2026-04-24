"""
Collaborative filtering for POI ranking using group nomination/upvote history.
Uses sklearn NearestNeighbors on group preference vectors.
"""
from sklearn.neighbors import NearestNeighbors
import numpy as np
from collections import defaultdict

PLACE_TYPES = [
    "restaurant", "cafe", "bar", "museum", "park", "shopping",
    "hotel", "beach", "attraction", "nightlife", "spa", "sport"
]


class POIRanker:
    def build_preference_vector(self, upvoted_place_types: list[str]) -> np.ndarray:
        """Convert a list of place_types the group upvoted into a preference vector."""
        vec = np.zeros(len(PLACE_TYPES))
        for pt in upvoted_place_types:
            if pt in PLACE_TYPES:
                vec[PLACE_TYPES.index(pt)] += 1
        norm = np.linalg.norm(vec)
        return vec / norm if norm > 0 else vec

    def rank_candidates(
        self,
        group_upvoted_types: list[str],
        candidates: list[dict],
        all_groups_history: list[list[str]] = None
    ) -> list[dict]:
        """
        Rank candidates by similarity to this group's preferences.
        Falls back to simple preference matching if no history data.
        Each candidate dict must have a 'place_type' key.
        Returns candidates sorted by score descending, with 'rank_score' added.
        """
        group_vec = self.build_preference_vector(group_upvoted_types)

        if all_groups_history and len(all_groups_history) >= 3:
            # Build matrix of all group preference vectors (including this group)
            all_vecs = np.array([
                self.build_preference_vector(history)
                for history in all_groups_history
            ])

            # Fit NearestNeighbors on historical group vectors
            k = min(3, len(all_vecs))
            nn = NearestNeighbors(n_neighbors=k, metric="cosine")
            nn.fit(all_vecs)

            # Find nearest neighbor groups to this group
            distances, indices = nn.kneighbors([group_vec])
            # Combine neighbor vectors into a blended preference vector
            neighbor_vecs = all_vecs[indices[0]]
            # Weight by similarity (1 - cosine distance)
            weights = 1.0 - distances[0]
            weight_sum = weights.sum()
            if weight_sum > 0:
                blended_vec = np.average(neighbor_vecs, axis=0, weights=weights)
            else:
                blended_vec = group_vec

            # Normalize blended vector
            norm = np.linalg.norm(blended_vec)
            if norm > 0:
                blended_vec = blended_vec / norm

            # Score each candidate against the blended preference vector
            for candidate in candidates:
                place_type = candidate.get("place_type", "")
                candidate_vec = self.build_preference_vector([place_type])
                score = float(np.dot(blended_vec, candidate_vec))
                candidate["rank_score"] = round(score, 4)

        else:
            # Fallback: simple dot product similarity between group vec and candidate type vec
            for candidate in candidates:
                place_type = candidate.get("place_type", "")
                candidate_vec = self.build_preference_vector([place_type])
                score = float(np.dot(group_vec, candidate_vec))
                candidate["rank_score"] = round(score, 4)

        return sorted(candidates, key=lambda c: c["rank_score"], reverse=True)
