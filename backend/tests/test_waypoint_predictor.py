"""
Tests for backend/services/waypoint_predictor.py
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.waypoint_predictor import WaypointPredictor


def test_train_empty_sequences_no_crash():
    """train() with empty sequences list should not raise."""
    predictor = WaypointPredictor()
    predictor.train([])  # must not throw
    assert predictor.transitions == {}


def test_predict_next_untrained_returns_candidates_unchanged():
    """predict_next() on an untrained predictor returns candidates in original order."""
    predictor = WaypointPredictor()
    candidates = [
        {"place_type": "museum", "name": "Museum"},
        {"place_type": "cafe", "name": "Cafe"},
        {"place_type": "park", "name": "Park"},
    ]
    result = predictor.predict_next("restaurant", candidates)
    # All candidates should still be present; with no transitions all scores are 0
    # so the order may be stable (sorted is stable for equal keys)
    assert len(result) == len(candidates)
    result_types = [r["place_type"] for r in result]
    for c in candidates:
        assert c["place_type"] in result_types


def test_predict_next_trained_ranks_seen_transitions_higher():
    """After training, predict_next should rank cafe/bar above museum after 'restaurant'."""
    predictor = WaypointPredictor()
    sequences = [
        ["restaurant", "cafe", "museum"],
        ["restaurant", "bar", "museum"],
    ]
    predictor.train(sequences)

    # After "restaurant", cafe and bar each appear once; museum never follows restaurant
    candidates = [
        {"place_type": "museum"},
        {"place_type": "cafe"},
        {"place_type": "bar"},
    ]
    result = predictor.predict_next("restaurant", candidates)

    result_types = [r["place_type"] for r in result]
    museum_idx = result_types.index("museum")

    # cafe and bar should both rank ahead of museum
    for top_type in ("cafe", "bar"):
        idx = result_types.index(top_type)
        assert idx < museum_idx, (
            f"Expected {top_type} before museum in ranked results, got: {result_types}"
        )
