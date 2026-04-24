"""
K-means clustering of trip photos by GPS coordinates.
Groups photos into "moments" like "Day 1: Venice Beach".
Falls back to date-based grouping if fewer than 3 photos have coordinates.
"""
from sklearn.cluster import KMeans
import numpy as np
from datetime import datetime, timezone


class PhotoClusterer:
    def cluster(self, photos: list[dict], n_clusters: int = None) -> list[dict]:
        """
        photos: list of dicts with keys: id, public_url, lat, lng, created_at, caption
        Returns: same photos with added key 'group_label' (str) and 'group_id' (int)

        If lat/lng available on enough photos: K-means on coordinates, label each cluster
        with a generated name like "Stop 1", "Stop 2" etc (we can't reverse geocode here).

        If not enough geo data: group by date (Day 1, Day 2, etc based on created_at).

        Auto-selects n_clusters as min(len(photos)//3, 6) capped between 2 and 6.
        """
        if not photos:
            return photos

        photos = [dict(p) for p in photos]

        # Determine which photos have valid lat/lng
        geo_photos = [
            p for p in photos
            if p.get("lat") is not None and p.get("lng") is not None
        ]

        if len(geo_photos) >= 3:
            return self._cluster_by_geo(photos, geo_photos, n_clusters)
        else:
            return self._cluster_by_date(photos)

    # ── Geo clustering ────────────────────────────────────────────────────────

    def _cluster_by_geo(
        self,
        photos: list[dict],
        geo_photos: list[dict],
        n_clusters: int | None,
    ) -> list[dict]:
        n = len(geo_photos)
        if n_clusters is None:
            n_clusters = max(2, min(n // 3, 6))

        coords = np.array([[p["lat"], p["lng"]] for p in geo_photos])

        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init="auto")
        labels = kmeans.fit_predict(coords)

        # Decide ordering axis: whichever has higher variance (lat vs lng)
        center_lats = kmeans.cluster_centers_[:, 0]
        center_lngs = kmeans.cluster_centers_[:, 1]
        lat_var = float(np.var(center_lats))
        lng_var = float(np.var(center_lngs))

        if lng_var >= lat_var:
            # Order west to east by mean longitude
            order_values = center_lngs
        else:
            # Order south to north by mean latitude
            order_values = center_lats

        # Map original cluster id -> rank (0-based)
        sorted_cluster_ids = np.argsort(order_values)
        rank_map = {int(cid): rank for rank, cid in enumerate(sorted_cluster_ids)}

        # Build id -> label map for geo photos
        geo_id_to_label: dict[str, tuple[str, int]] = {}
        for photo, label in zip(geo_photos, labels):
            rank = rank_map[int(label)]
            geo_id_to_label[photo["id"]] = (f"Stop {rank + 1}", rank)

        # Assign labels; photos without geo fall back to date grouping individually
        no_geo = [p for p in photos if p.get("lat") is None or p.get("lng") is None]
        if no_geo:
            # Date-cluster the non-geo photos, offsetting group_ids above geo clusters
            no_geo_clustered = self._cluster_by_date(no_geo, group_id_offset=n_clusters)
        else:
            no_geo_clustered = []

        no_geo_by_id = {p["id"]: p for p in no_geo_clustered}

        for photo in photos:
            if photo["id"] in geo_id_to_label:
                label, gid = geo_id_to_label[photo["id"]]
                photo["group_label"] = label
                photo["group_id"] = gid
            else:
                merged = no_geo_by_id.get(photo["id"], photo)
                photo["group_label"] = merged.get("group_label", "Other")
                photo["group_id"] = merged.get("group_id", n_clusters)

        return photos

    # ── Date clustering ───────────────────────────────────────────────────────

    def _cluster_by_date(
        self,
        photos: list[dict],
        group_id_offset: int = 0,
    ) -> list[dict]:
        """Group photos by calendar date (UTC). Labels: Day 1, Day 2, ..."""

        def parse_date(p: dict) -> str:
            raw = p.get("created_at")
            if not raw:
                return "9999-99-99"  # unknown dates go last
            try:
                dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
                return dt.astimezone(timezone.utc).strftime("%Y-%m-%d")
            except Exception:
                return "9999-99-99"

        # Collect unique dates in sorted order
        date_set: set[str] = set()
        for p in photos:
            date_set.add(parse_date(p))

        sorted_dates = sorted(date_set)
        date_to_rank = {d: i for i, d in enumerate(sorted_dates)}

        for photo in photos:
            date_str = parse_date(photo)
            rank = date_to_rank[date_str]
            if date_str == "9999-99-99":
                photo["group_label"] = "Other"
            else:
                photo["group_label"] = f"Day {rank + 1}"
            photo["group_id"] = group_id_offset + rank

        return photos
