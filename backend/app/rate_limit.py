from collections import defaultdict, deque
from threading import Lock
from time import monotonic

from fastapi import HTTPException, Request


class SlidingWindowLimiter:
    def __init__(self, attempts: int, window_seconds: int):
        self.attempts = attempts
        self.window_seconds = window_seconds
        self.events: dict[str, deque[float]] = defaultdict(deque)
        self.lock = Lock()

    def check(self, request: Request) -> None:
        forwarded = request.headers.get("x-forwarded-for", "")
        address = forwarded.split(",", 1)[0].strip()
        if not address:
            address = request.client.host if request.client else "unknown"
        key = f"{address}:{request.url.path}"
        now = monotonic()
        threshold = now - self.window_seconds
        with self.lock:
            attempts = self.events[key]
            while attempts and attempts[0] <= threshold:
                attempts.popleft()
            if len(attempts) >= self.attempts:
                retry_after = max(1, int(self.window_seconds - (now - attempts[0])))
                raise HTTPException(
                    429,
                    "Demasiados intentos. Espera unos minutos antes de volver a intentar.",
                    headers={"Retry-After": str(retry_after)},
                )
            attempts.append(now)


login_limiter = SlidingWindowLimiter(attempts=30, window_seconds=300)
registration_limiter = SlidingWindowLimiter(attempts=20, window_seconds=3600)


def limit_login(request: Request) -> None:
    login_limiter.check(request)


def limit_registration(request: Request) -> None:
    registration_limiter.check(request)
