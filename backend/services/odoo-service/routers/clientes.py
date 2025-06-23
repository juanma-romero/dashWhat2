from fastapi import APIRouter # type: ignore
from schemas import cliente_schema
from services import odoo_service

router = APIRouter(
    prefix="/clientes",
    tags=["Clientes"]
)

@router.get("/buscar/", summary="Buscar Cliente por Teléfono")
async def buscar_cliente(telefono: str):
    return await odoo_service.buscar_cliente_por_telefono(telefono)
