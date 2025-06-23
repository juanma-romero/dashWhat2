# schemas/pedido_schema.py
from pydantic import BaseModel # type: ignore
from typing import List

class Producto(BaseModel):
    id: int
    cantidad: float

class Pedido(BaseModel):
    id_cliente: int
    productos: List[Producto]