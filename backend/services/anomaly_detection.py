"""
Expense Anomaly Detection using Isolation Forest (per-category) with z-score fallback.
"""

from sklearn.ensemble import IsolationForest
import numpy as np


class ExpenseAnomalyDetector:
    def detect(self, expenses: list[dict]) -> list[dict]:
        """
        Given a list of expense dicts with keys: id, amount, category
        Returns same list with added keys: is_anomaly (bool), anomaly_score (float).
        Groups by category and runs Isolation Forest per category.
        Falls back to z-score if < 5 samples in a category.
        """
        if not expenses:
            return expenses

        # Group indices by category
        category_indices: dict[str, list[int]] = {}
        for i, expense in enumerate(expenses):
            cat = expense.get("category") or "Other"
            category_indices.setdefault(cat, []).append(i)

        # Initialize all expenses with defaults
        result = [dict(e, is_anomaly=False, anomaly_score=0.0) for e in expenses]

        for category, indices in category_indices.items():
            amounts = np.array([expenses[i]["amount"] for i in indices], dtype=float)

            if len(indices) >= 5:
                # Isolation Forest
                amounts_2d = amounts.reshape(-1, 1)
                clf = IsolationForest(contamination=0.1, random_state=42)
                clf.fit(amounts_2d)
                raw_scores = clf.decision_function(amounts_2d)  # higher = more normal
                predictions = clf.predict(amounts_2d)  # -1 = anomaly, 1 = normal

                for local_idx, global_idx in enumerate(indices):
                    # Normalize score to [0, 1] where 1 = most anomalous
                    anomaly_score = float(np.clip(-raw_scores[local_idx], 0, 1))
                    result[global_idx]["is_anomaly"] = bool(predictions[local_idx] == -1)
                    result[global_idx]["anomaly_score"] = round(anomaly_score, 4)
            else:
                # Z-score fallback
                if len(amounts) < 2:
                    # Single sample: can't determine anomaly
                    for global_idx in indices:
                        result[global_idx]["is_anomaly"] = False
                        result[global_idx]["anomaly_score"] = 0.0
                    continue

                mean = float(np.mean(amounts))
                std = float(np.std(amounts))

                for local_idx, global_idx in enumerate(indices):
                    if std == 0:
                        z = 0.0
                    else:
                        z = abs(float(amounts[local_idx]) - mean) / std
                    # Flag as anomaly if z-score > 2.0
                    is_anomaly = z > 2.0
                    # Normalize z-score to a rough [0, 1] score (cap at z=4)
                    anomaly_score = round(min(z / 4.0, 1.0), 4)
                    result[global_idx]["is_anomaly"] = is_anomaly
                    result[global_idx]["anomaly_score"] = anomaly_score

        return result
