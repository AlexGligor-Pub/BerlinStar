from __future__ import annotations
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

_PASSWORD_1 = "alexgligor"
_PASSWORD_2 = "ADASTools1"


class VerifyRequest(BaseModel):
    password1: str
    password2: str


@router.post("/verify")
async def verify_admin(body: VerifyRequest):
    if body.password1 != _PASSWORD_1 or body.password2 != _PASSWORD_2:
        raise HTTPException(status_code=401, detail="Parole incorecte.")
    return {"ok": True}
