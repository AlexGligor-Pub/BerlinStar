from __future__ import annotations
import jwt
from fastapi import Header, HTTPException

from app.config import SECRET_KEY, ALGORITHM


async def get_account_id(authorization: str = Header(..., alias="Authorization")) -> int:
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Token lipsa sau invalid.")
    token = authorization[7:]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return int(payload["sub"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expirat.")
    except Exception:
        raise HTTPException(401, "Token invalid.")
