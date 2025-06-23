# main.py
from fastapi import FastAPI # type: ignore
from fastapi.middleware.cors import CORSMiddleware # type: ignore
from routers import pedidos # Importamos nuestro nuevo router de pedidos

app = FastAPI(
    title="Servicio de Integración con Odoo para Voraz",
    description="Una API para conectar el backend con Odoo Online.",
    version="1.0.0"
)

# --- Configuración de CORS ---
origins = [
    "http://localhost",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:8000",
    "http://0.0.0.0:8080",
    "null",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Incluir Routers ---
# Aquí es donde conectamos el archivo del router a nuestra aplicación principal.
app.include_router(pedidos.router)


# --- Endpoint Raíz ---
@app.get("/")
def read_root():
    return {"mensaje": "El servicio de integración con Odoo para Voraz está activo."}
