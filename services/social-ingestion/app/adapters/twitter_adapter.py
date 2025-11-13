import requests
from datetime import datetime, timezone
from .base_adapter import BaseAdapter

class TwitterAdapter(BaseAdapter):
    platform = "twitter"

    def __init__(self, bearer_token):
        self.bearer_token = bearer_token
        self.base_url = "https://api.twitter.com/2"
        self.session = requests.Session()
        self.session.headers.update({"Authorization": f"Bearer {self.bearer_token}"})

    def _build_query(self, keywords, geo_filter=None):
        # Build search query: combine keywords with OR, restrict to English, exclude retweets
        q = " OR ".join([f'"{k}"' if " " in k else k for k in keywords])
        q += " lang:en -is:retweet"
        # Optionally add geo_filter keyword if provided
        if geo_filter:
            q += f' ({geo_filter})'
        return q

    def search_posts(self, keywords, geo_filter=None, since_id=None, limit=100):
        """
        Searches Twitter for recent posts matching hazard-related keywords.
        Returns standardized posts with ISO 8601 UTC created_at and normalized location info.
        """
        query = self._build_query(keywords, geo_filter)
        url = f"{self.base_url}/tweets/search/recent"

        params = {
            "query": query,
            "max_results": min(limit, 100),
            "tweet.fields": "id,text,created_at,author_id,geo",
            "expansions": "author_id,geo.place_id",
            "user.fields": "username,name,location",
            "place.fields": "full_name,country,country_code,place_type"
        }
        if since_id:
            params["since_id"] = since_id

        resp = self.session.get(url, params=params, timeout=15)
        resp.raise_for_status()
        payload = resp.json()

        users_by_id = {u["id"]: u for u in payload.get("includes", {}).get("users", [])}
        places_by_id = {p["id"]: p for p in payload.get("includes", {}).get("places", [])}

        posts = []
        for t in payload.get("data", []):
            user = users_by_id.get(t.get("author_id"), {})
            place = None
            if "geo" in t and t["geo"].get("place_id"):
                place = places_by_id.get(t["geo"]["place_id"])

            # --- Normalize created_at ---
            created_raw = t.get("created_at")
            created_at = None
            if created_raw:
                try:
                    dt = datetime.fromisoformat(created_raw.replace("Z", "+00:00"))
                    created_at = dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
                except Exception:
                    created_at = created_raw  # fallback to raw if parsing fails

            # --- Normalize location ---
            if place:
                location = {
                    "name": place.get("full_name"),
                    "country": place.get("country"),
                    "country_code": place.get("country_code"),
                    "place_type": place.get("place_type"),
                    "source": "tweet"
                }
            elif user.get("location"):
                location = {
                    "name": user["location"],
                    "source": "user"
                }
            else:
                location = None

            # --- Build standardized post object ---
            posts.append({
                "id": t["id"],
                "text": t["text"],
                "created_at": created_at,
                "user": {
                    "id": user.get("id"),
                    "name": user.get("name"),
                    "username": user.get("username")
                },
                "location": location,
                "platform": self.platform,
                "extra": {"raw": t}
            })

        return posts
