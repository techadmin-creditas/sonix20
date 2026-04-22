from __future__ import annotations

import base64
import hashlib
import hmac
import os
import time
from typing import Any, Optional

import jwt

from voicebot.shared.config import get_settings

settings = get_settings()


def hash_password(password: str, *, iterations: int = 150_000) -> str:
    salt = os.urandom(16).hex()
    dk = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), bytes.fromhex(salt), iterations
    ).hex()
    return f"pbkdf2_sha256${iterations}${salt}${dk}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algo, iter_s, salt, digest = encoded.split("$", 3)
        if algo != "pbkdf2_sha256":
            return False
        iterations = int(iter_s)
    except Exception:
        return False
    got = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), bytes.fromhex(salt), iterations
    ).hex()
    return hmac.compare_digest(got, digest)


def issue_access_token(user_id: str, username: str, role: str, permissions: list[str] = []) -> str:
    now = int(time.time())
    exp = now + int(settings.jwt_access_token_expire_minutes * 60)
    payload = {
        "sub": user_id,
        "username": username,
        "roles": [role],
        "permissions": permissions,
        "iat": now,
        "exp": exp,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> Optional[dict[str, Any]]:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        return payload
    except Exception:
        return None

