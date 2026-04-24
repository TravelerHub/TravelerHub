"""
Tests for backend/services/anomaly_detection.py
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.anomaly_detection import ExpenseAnomalyDetector


def make_expense(id, amount, category):
    return {"id": id, "amount": amount, "category": category}


def test_detect_empty_list():
    """detect() with empty input returns empty list."""
    detector = ExpenseAnomalyDetector()
    result = detector.detect([])
    assert result == []


def test_detect_less_than_5_in_category_no_crash():
    """< 5 expenses in a category uses z-score fallback without crashing."""
    detector = ExpenseAnomalyDetector()
    expenses = [
        make_expense(i, 10.0 + i, "food")
        for i in range(4)  # 4 items — triggers z-score fallback
    ]
    result = detector.detect(expenses)
    assert len(result) == 4
    for item in result:
        assert "is_anomaly" in item
        assert "anomaly_score" in item


def test_detect_flags_clear_anomaly():
    """10+ expenses in a category — the $500 outlier among $10s should be flagged."""
    detector = ExpenseAnomalyDetector()
    expenses = [make_expense(i, 10.0, "food") for i in range(9)]
    expenses.append(make_expense(9, 500.0, "food"))

    result = detector.detect(expenses)

    anomalous = [r for r in result if r["is_anomaly"]]
    assert len(anomalous) >= 1
    # The $500 expense should be among the flagged ones
    flagged_amounts = [r["amount"] for r in anomalous]
    assert 500.0 in flagged_amounts


def test_detect_all_items_have_required_keys():
    """Every returned item has is_anomaly and anomaly_score."""
    detector = ExpenseAnomalyDetector()
    expenses = [
        make_expense(0, 20.0, "transport"),
        make_expense(1, 25.0, "transport"),
        make_expense(2, 300.0, "transport"),
        make_expense(3, 22.0, "food"),
    ]
    result = detector.detect(expenses)
    assert len(result) == len(expenses)
    for item in result:
        assert "is_anomaly" in item, f"Missing is_anomaly in {item}"
        assert "anomaly_score" in item, f"Missing anomaly_score in {item}"
        assert isinstance(item["is_anomaly"], bool)
        assert isinstance(item["anomaly_score"], float)
