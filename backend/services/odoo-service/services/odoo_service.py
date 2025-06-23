# services/odoo_service.py
import xmlrpc.client
import ssl
import certifi # type: ignore
from datetime import datetime, timezone
from fastapi import HTTPException # type: ignore
import os
from dotenv import load_dotenv # type: ignore

# Cargar variables de entorno desde .env
load_dotenv(override=True)

# --- Configuración de Odoo ---
URL = os.getenv("URL")
DB = os.getenv("DB")
USERNAME = os.getenv("USERNAME")
PASSWORD = os.getenv("PASSWORD")

# --- Lógica de Conexión a Odoo (Función Auxiliar) ---
def get_odoo_models():
    """
    Se conecta a Odoo y devuelve el proxy 'models' y el uid.
    Esta función es síncrona porque no realiza operaciones de red que se beneficien de await aquí.
    Las llamadas a Odoo (execute_kw) son las que bloquean.
    """
    try:
        ssl_context = ssl.create_default_context(purpose=ssl.Purpose.SERVER_AUTH, cafile=certifi.where())
        common = xmlrpc.client.ServerProxy(f"{URL}/xmlrpc/2/common", context=ssl_context)
        uid = common.authenticate(DB, USERNAME, PASSWORD, {})

        if not uid:
            raise HTTPException(status_code=500, detail="Fallo en la autenticación con Odoo. Revisa credenciales.")

        models = xmlrpc.client.ServerProxy(f"{URL}/xmlrpc/2/object", context=ssl_context)
        return models, uid

    except Exception as e:
        print(f"Error conectando a Odoo: {e}")
        raise HTTPException(status_code=503, detail=f"No se pudo conectar o autenticar con Odoo: {e}")

# --- Lógica del Servicio ---

async def listar_pedidos_pendientes_logic(limite: int):
    """
    Lógica para obtener una lista de las órdenes de venta pendientes de entrega.
    """
    print(f"Ejecutando lógica para listar los últimos {limite} pedidos pendientes.")
    try:
        models, uid = get_odoo_models()
        
        ahora = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')

        sale_order_domain = [
            '&',
            ['state', '=', 'sale'],
            ['commitment_date', '>=', ahora]
        ]
        
        sale_order_fields = [
            'name', 'partner_id', 'date_order', 'commitment_date', 
            'amount_total', 'state', 'order_line'
        ]

        orders_data = models.execute_kw(DB, uid, PASSWORD,
            'sale.order', 'search_read',
            [sale_order_domain],
            {'fields': sale_order_fields, 'limit': limite, 'order': 'commitment_date ASC'}
        )

        if orders_data:
            for order in orders_data:
                order_line_ids = order.get('order_line', [])
                if order_line_ids:
                    line_fields = ['product_id', 'name', 'product_uom_qty']
                    lines_data = models.execute_kw(DB, uid, PASSWORD,
                        'sale.order.line', 'read',
                        [order_line_ids],
                        {'fields': line_fields}
                    )
                    order['detalle_productos'] = lines_data
                else:
                    order['detalle_productos'] = []

            return {
                "status": "exito",
                "cantidad": len(orders_data),
                "pedidos": orders_data
            }
        else:
            return {
                "status": "exito",
                "cantidad": 0,
                "pedidos": [],
                "mensaje": "No se encontraron pedidos pendientes de entrega."
            }
            
    except xmlrpc.client.Fault as e:
        raise HTTPException(status_code=400, detail=f"Error de Odoo: {e.faultString}")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Un error inesperado ocurrió: {e}")

