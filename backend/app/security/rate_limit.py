"""Limitation de débit en mémoire, par fenêtre glissante.

Suffisant pour un seul processus. Avec plusieurs workers, il faudrait un compteur
partagé (Redis), car chacun aurait ses propres compteurs.
"""

import time
from collections import defaultdict, deque
from collections.abc import Callable
from threading import Lock

from fastapi import HTTPException, Request, status


class RateLimiter:
    def __init__(self, limit: int, window_seconds: int) -> None:
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] >= self.window:
                hits.popleft()
            if not hits:
                # Évite de garder en mémoire une entrée par adresse IP vue une seule fois
                del self._hits[key]
            if len(hits) >= self.limit:
                return False
            self._hits[key].append(now)
            return True

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "inconnu"


def enforce(limiter: RateLimiter, key: str) -> None:
    if not limiter.allow(key):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Trop de requêtes, réessayez dans un instant.",
            headers={"Retry-After": str(limiter.window)},
        )


def limit_by_ip(limiter: RateLimiter) -> Callable[[Request], None]:
    def dependency(request: Request) -> None:
        enforce(limiter, client_ip(request))

    return dependency


login_limiter = RateLimiter(limit=10, window_seconds=60)
register_limiter = RateLimiter(limit=10, window_seconds=3600)
public_limiter = RateLimiter(limit=60, window_seconds=60)
report_limiter = RateLimiter(limit=20, window_seconds=3600)
refresh_limiter = RateLimiter(limit=30, window_seconds=60)

ALL_LIMITERS = (login_limiter, register_limiter, public_limiter, report_limiter, refresh_limiter)
