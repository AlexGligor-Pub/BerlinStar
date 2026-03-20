from __future__ import annotations
import jwt
from fastapi import Depends, HTTPException, Query
from fastapi.security import OAuth2PasswordBearer

from app.config import SECRET_KEY, ALGORITHM

_oauth2 = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


async def get_account_id(token: str = Depends(_oauth2)) -> int:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return int(payload["sub"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expirat.")
    except Exception:
        raise HTTPException(401, "Token invalid.")


async def get_account_id_from_query(token: str = Query(...)) -> int:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return int(payload["sub"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expirat.")
    except Exception:
        raise HTTPException(401, "Token invalid.")
