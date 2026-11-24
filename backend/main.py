from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os, hmac, hashlib, base64, json, time
import pandas as pd
import joblib

app = FastAPI(title="Orión API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)



# ── Autenticación básica para el prototipo ─────────────────────────
# Cambia estas variables de entorno antes de publicar el sistema.
ADMIN_USER = os.getenv("ORION_ADMIN_USER", "admin")
ADMIN_PASSWORD = os.getenv("ORION_ADMIN_PASSWORD", "Orion2026!")
SECRET_KEY = os.getenv("ORION_SECRET_KEY", "cambia-esta-clave-en-produccion")
TOKEN_TTL = 8 * 60 * 60
bearer_scheme = HTTPBearer(auto_error=False)

class LoginRequest(BaseModel):
    username: str
    password: str

def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")

def create_token(username: str) -> str:
    payload = _b64(json.dumps({"sub": username, "exp": int(time.time()) + TOKEN_TTL}).encode())
    signature = hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).digest()
    return payload + "." + _b64(signature)

def require_auth(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inicia sesión para continuar")
    token = credentials.credentials
    try:
        payload_part, signature_part = token.split(".", 1)
        expected = _b64(hmac.new(SECRET_KEY.encode(), payload_part.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(signature_part, expected):
            raise ValueError("Firma inválida")
        payload = json.loads(base64.urlsafe_b64decode(payload_part + "=" * (-len(payload_part) % 4)))
        if payload.get("exp", 0) < int(time.time()):
            raise ValueError("Token expirado")
        return payload["sub"]
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesión inválida o expirada")

@app.post("/login")
def login(req: LoginRequest):
    if not hmac.compare_digest(req.username, ADMIN_USER) or not hmac.compare_digest(req.password, ADMIN_PASSWORD):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario o contraseña incorrectos")
    return {"access_token": create_token(req.username), "token_type": "bearer", "username": req.username}


# ── Carga de datos y modelo ──────────────────────────────────────
df    = pd.read_csv("Orion_Dataset_Ventas_Enriquecido.csv")
df["fecha"] = pd.to_datetime(df["fecha"], dayfirst=True)
modelo = joblib.load("modelo_orion.pkl")


# ── Endpoint: métricas del dashboard ────────────────────────────
@app.get("/dashboard")
def get_dashboard(periodo: str = "diario", usuario: str = Depends(require_auth)):
    # KPIs
    kpis = {
        "ventas_totales":  int(df["ventas"].sum()),
        "num_productos":   int(df["producto"].nunique()),
        "promedio_diario": round(float(df["ventas"].mean()), 1),
        "precision_modelo": 88.66,
    }

    # Ventas por producto
    ventas_producto = (
        df.groupby("producto")["ventas"]
        .sum()
        .sort_values(ascending=False)
    )
    por_producto = [
        {"producto": k, "ventas": int(v)}
        for k, v in ventas_producto.items()
    ]

    # Tendencia según periodo
    freq_map = {"diario": "D", "semanal": "W", "mensual": "ME"}
    freq = freq_map.get(periodo.lower(), "D")
    serie = (
        df.set_index("fecha")
        .resample(freq)["ventas"]
        .sum()
        .reset_index()
    )
    tendencia = [
        {"fecha": str(r["fecha"].date()), "ventas": int(r["ventas"])}
        for _, r in serie.iterrows()
    ]

    # Top 5
    top5 = (
        df.groupby("producto")["ventas"]
        .sum()
        .sort_values(ascending=False)
        .head(5)
    )
    top_cinco = [
        {"producto": k, "ventas": int(v)}
        for k, v in top5.items()
    ]

    return {
        "kpis":         kpis,
        "por_producto": por_producto,
        "tendencia":    tendencia,
        "top_cinco":    top_cinco,
    }


# ── Endpoint: predicción ─────────────────────────────────────────
productos_dict = {
    "Agua Ciel 1L": 0, "Chocolate Carlos V": 1, "Coca-Cola 600ml": 2,
    "Galletas Oreo": 3, "Jugo Del Valle 500ml": 4, "Maruchan Camarón": 5,
    "Panditas 100g": 6, "Red Bull 250ml": 7, "Sabritas Original 45g": 8,
    "Sprite 600ml": 9,
}
climas_dict = {
    "Soleado": 0, "Parcialmente Nublado": 1, "Nublado": 2,
    "Lluvioso": 3, "Frío": 4,
}

class PredRequest(BaseModel):
    producto:    str
    fecha:       str        # "YYYY-MM-DD"
    temperatura: float
    clima:       str
    festivo:     bool
    horizonte:   str        # "diaria" | "semanal" | "mensual"

class LoteRequest(BaseModel):
    fecha:       str
    temperatura: float
    clima:       str
    festivo:     bool
    horizonte:   str   # "diaria" | "semanal" | "mensual"

@app.post("/predecir-lote")
def predecir_lote(req: LoteRequest, usuario: str = Depends(require_auth)):
    from datetime import date
    fecha = date.fromisoformat(req.fecha)
    mult  = {"diaria": 1, "semanal": 7, "mensual": 30}[req.horizonte]

    filas = []
    for nombre, pid in productos_dict.items():
        entrada = pd.DataFrame([{
            "producto_id":   pid,
            "dia_semana":    fecha.weekday(),
            "festivo":       int(req.festivo),
            "temperatura_c": req.temperatura,
            "clima":         climas_dict[req.clima],
            "mes":           fecha.month,
            "año":           fecha.year,
        }])
        pred_diaria = round(float(modelo.predict(entrada)[0]))
        demanda     = int(pred_diaria * mult)
        stock       = round(demanda * 1.20)
        margen      = stock - demanda
        filas.append({
            "producto": nombre,
            "demanda":  demanda,
            "stock":    stock,
            "margen":   margen,
        })

    total_demanda = sum(f["demanda"] for f in filas)
    total_stock   = sum(f["stock"]   for f in filas)

    return {
        "productos":     filas,
        "total_demanda": total_demanda,
        "total_stock":   total_stock,
        "horizonte":     req.horizonte,
        "fecha":         req.fecha,
    }


@app.post("/predecir")
def predecir(req: PredRequest, usuario: str = Depends(require_auth)):
    from datetime import date
    fecha = date.fromisoformat(req.fecha)

    entrada = pd.DataFrame([{
        "producto_id":   productos_dict[req.producto],
        "dia_semana":    fecha.weekday(),
        "festivo":       int(req.festivo),
        "temperatura_c": req.temperatura,
        "clima":         climas_dict[req.clima],
        "mes":           fecha.month,
        "año":           fecha.year,
    }])

    pred_diaria   = round(float(modelo.predict(entrada)[0]))
    mult          = {"diaria": 1, "semanal": 7, "mensual": 30}[req.horizonte]
    demanda       = int(pred_diaria * mult)
    stock         = round(demanda * 1.20)
    margen        = stock - demanda

    return {
        "demanda":  demanda,
        "stock":    stock,
        "margen":   margen,
        "horizonte": req.horizonte,
    }
