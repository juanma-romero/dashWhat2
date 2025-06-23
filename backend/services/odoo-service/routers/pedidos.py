# routers/pedidos.py
from fastapi import APIRouter # type: ignore
from services import odoo_service # Importamos nuestro módulo de lógica

# Creamos un router. Es como una mini-aplicación de FastAPI.
router = APIRouter(
    prefix="/pedidos", # Todas las URLs en este archivo comenzarán con /pedidos
    tags=["Pedidos"]     # Esto agrupará los endpoints en la documentación /docs
)

@router.get("/pendientes/", summary="Listar Pedidos Pendientes de Entrega")
async def listar_pedidos_pendientes(limite: int = 10):
    """
    Endpoint para obtener una lista de las órdenes de venta pendientes.
    Este endpoint es delgado y solo se encarga de llamar a la lógica de negocio.
    """
    # La corrección clave: ¡usamos 'await' para esperar el resultado!
    return await odoo_service.listar_pedidos_pendientes_logic(limite)

# Aquí podrías agregar más endpoints relacionados con pedidos en el futuro
# ej: @router.get("/{pedido_id}")
# ej: @router.post("/crear")

