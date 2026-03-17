"""JWT authentication helpers for the SunTran Simulation API."""

import bcrypt
import json
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

SECRET_KEY = os.getenv("JWT_SECRET", "suntran-simulator-dev-secret-changeme")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8-hour sessions

USERS_FILE = os.path.join(os.path.dirname(__file__), "users.json")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# ---------------------------------------------------------------------------
# User store
# ---------------------------------------------------------------------------

def _load_users() -> dict[str, str]:
    if not os.path.exists(USERS_FILE):
        return {}
    with open(USERS_FILE) as f:
        return json.load(f)

# ---------------------------------------------------------------------------
# Auth logic
# ---------------------------------------------------------------------------

def authenticate_user(username: str, password: str) -> Optional[str]:
    """Return the username on success, None on failure."""
    users = _load_users()
    hashed = users.get(username)
    if not hashed:
        return None
    if not bcrypt.checkpw(password.encode(), hashed.encode()):
        return None
    return username


def create_access_token(username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": username, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme)) -> str:
    """FastAPI dependency — raises 401 if token is missing or invalid."""
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            raise exc
    except JWTError:
        raise exc

    users = _load_users()
    if username not in users:
        raise exc
    return username
