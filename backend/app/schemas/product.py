from pydantic import BaseModel


class ProductCompat(BaseModel):
    """Shape asteptata de frontend-ul SolidJS existent."""
    id: int
    name: str
    price: float   # float, nu Decimal — frontend-ul face .toFixed(2) care cere JS number
    unit: str
    category: str  # numele categoriei, nu id-ul
