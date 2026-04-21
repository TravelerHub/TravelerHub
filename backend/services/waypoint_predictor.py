"""
Next Waypoint Prediction using a Markov Chain over place_type transitions.
"""


class WaypointPredictor:
    def __init__(self):
        self.transitions: dict[str, dict[str, int]] = {}
        # {from_place_type: {to_place_type: count}}

    def train(self, visit_sequences: list[list[str]]) -> None:
        """Build transition matrix from sequences of place_type strings."""
        self.transitions = {}
        for sequence in visit_sequences:
            for i in range(len(sequence) - 1):
                from_type = sequence[i]
                to_type = sequence[i + 1]
                if from_type not in self.transitions:
                    self.transitions[from_type] = {}
                self.transitions[from_type][to_type] = (
                    self.transitions[from_type].get(to_type, 0) + 1
                )

    def predict_next(self, current_place_type: str, candidates: list[dict]) -> list[dict]:
        """
        Given current place type and list of candidate waypoints (each with a
        'place_type' key), return candidates sorted by predicted likelihood of
        being visited next (highest likelihood first).

        Falls back to original order if no transition data is available for the
        current place type.
        """
        transitions_from = self.transitions.get(current_place_type, {})
        total_transitions = sum(transitions_from.values()) or 1

        def _score(candidate: dict) -> float:
            place_type = candidate.get("place_type", "")
            count = transitions_from.get(place_type, 0)
            return count / total_transitions

        return sorted(candidates, key=_score, reverse=True)
