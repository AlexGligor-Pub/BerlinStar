import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from dotenv import load_dotenv

load_dotenv()

# DATABASE_URL este obligatoriu. Pentru dev local SQLite, seteaza
# BERLINSTAR_DEV_SQLITE=1 explicit; altfel pornirea esueaza.
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    if os.getenv("BERLINSTAR_DEV_SQLITE") == "1":
        DATABASE_URL = "sqlite+aiosqlite:///./berlinstar.db"
    else:
        raise RuntimeError(
            "DATABASE_URL este obligatoriu. Seteaza postgresql+asyncpg://... "
            "sau BERLINSTAR_DEV_SQLITE=1 pentru fallback la SQLite in dev."
        )

_pool_kwargs = (
    dict(pool_size=10, max_overflow=10, pool_pre_ping=True, pool_recycle=3600, pool_timeout=30)
    if DATABASE_URL.startswith("postgresql")
    else {}
)

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    **_pool_kwargs,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
