import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from dotenv import load_dotenv

load_dotenv()

# Dev fallback: SQLite. În producție setează DATABASE_URL în .env la postgresql+asyncpg://...
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./berlinstar.db")

_pool_kwargs = (
    dict(pool_size=10, max_overflow=20, pool_pre_ping=True, pool_recycle=3600)
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
