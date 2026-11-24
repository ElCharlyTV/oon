import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

// ── Tokens ────────────────────────────────────────────────────────
const C = {
  bg:       "#F5F5F7",
  surface:  "#FFFFFF",
  ink:      "#1D1D1F",
  muted:    "#6E6E73",
  border:   "#E8E8ED",
  blue:     "#0071E3",
  blueHov:  "#0077ED",
  green:    "#34C759",
  pill:     "#E8E8ED",
};

// ── API base ──────────────────────────────────────────────────────
const API = "http://localhost:8000";

async function apiFetch(path, options = {}) {
  const token = sessionStorage.getItem("orion_token");
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API}${path}`, { ...options, headers });
  if (response.status === 401) {
    sessionStorage.removeItem("orion_token");
    sessionStorage.removeItem("orion_user");
    window.dispatchEvent(new Event("orion-session-expired"));
  }
  if (!response.ok) {
    let message = "Ocurrió un error al consultar el servidor.";
    try { message = (await response.json()).detail || message; } catch {}
    throw new Error(message);
  }
  return response;
}

// ── Catálogos ─────────────────────────────────────────────────────
const PRODUCTOS = [
  "Agua Ciel 1L","Chocolate Carlos V","Coca-Cola 600ml","Galletas Oreo",
  "Jugo Del Valle 500ml","Maruchan Camarón","Panditas 100g",
  "Red Bull 250ml","Sabritas Original 45g","Sprite 600ml",
];
const CLIMAS = ["Soleado","Parcialmente Nublado","Nublado","Lluvioso","Frío"];

// ── Helpers ───────────────────────────────────────────────────────
const fmt = (n) => n?.toLocaleString("es-MX") ?? "—";
const today = () => new Date().toISOString().slice(0, 10);

// ── Custom Tooltip ────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 10, padding: "8px 14px",
      fontSize: 13, color: C.ink, boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
    }}>
      <div style={{ color: C.muted, marginBottom: 2, fontSize: 11 }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{fmt(payload[0].value)}</div>
    </div>
  );
};

// ── Componentes base ──────────────────────────────────────────────
const Card = ({ children, style = {} }) => (
  <div style={{
    background: C.surface, borderRadius: 20,
    padding: "1.6rem 1.8rem", boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    marginBottom: "1.25rem", ...style,
  }}>
    {children}
  </div>
);

const Label = ({ children }) => (
  <div style={{
    fontSize: 11, fontWeight: 600, color: C.muted,
    textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6,
  }}>
    {children}
  </div>
);

const MetricCard = ({ label, value, color = C.ink }) => (
  <div style={{
    background: C.surface, borderRadius: 16,
    padding: "1.4rem 1.6rem", boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    transition: "box-shadow .2s",
  }}
    onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.10)"}
    onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)"}
  >
    <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
      {label}
    </div>
    <div style={{ fontSize: "2rem", fontWeight: 700, color, letterSpacing: "-0.03em", lineHeight: 1 }}>
      {value}
    </div>
  </div>
);

const Select = ({ label, value, onChange, options }) => (
  <div style={{ marginBottom: "1.2rem" }}>
    <Label>{label}</Label>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: "100%", padding: "0.6rem 0.9rem",
        borderRadius: 10, border: `1.5px solid ${C.border}`,
        background: C.bg, fontSize: 14, color: C.ink,
        fontFamily: "inherit", cursor: "pointer", outline: "none",
        appearance: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236E6E73' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 12px center",
        paddingRight: "2rem",
      }}
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

const PillGroup = ({ options, value, onChange }) => (
  <div style={{
    display: "inline-flex", background: C.pill,
    borderRadius: 12, padding: 4, gap: 3,
  }}>
    {options.map(o => (
      <button
        key={o}
        onClick={() => onChange(o)}
        style={{
          padding: "0.4rem 1.1rem", borderRadius: 9,
          border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500,
          fontFamily: "inherit", transition: "all .18s",
          background: value === o ? C.surface : "transparent",
          color:      value === o ? C.ink      : C.muted,
          boxShadow:  value === o ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
        }}
      >
        {o}
      </button>
    ))}
  </div>
);

// ── Loading skeleton ──────────────────────────────────────────────
const Skeleton = ({ h = 180 }) => (
  <div style={{
    height: h, borderRadius: 12,
    background: "linear-gradient(90deg,#E8E8ED 25%,#F5F5F7 50%,#E8E8ED 75%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 1.4s infinite",
  }} />
);

// ── Tab: Dashboard ────────────────────────────────────────────────
function Dashboard() {
  const [data, setData]       = useState(null);
  const [periodo, setPeriodo] = useState("Diario");
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const periodoApi = { Diario: "diario", Semanal: "semanal", Mensual: "mensual" };

  const load = useCallback(async (p) => {
    setLoading(true);
    setError(null);
    try {
      const res  = await apiFetch(`/dashboard?periodo=${periodoApi[p]}`);
      const json = await res.json();
      setData(json);
    } catch {
      setError("No se pudo conectar con el servidor. Asegúrate de que FastAPI esté corriendo en localhost:8000.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(periodo); }, [periodo]);

  const kpis = data?.kpis;

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1rem", marginBottom: "1.25rem" }}>
        {loading ? (
          [0,1,2,3].map(i => <div key={i} style={{ background: C.surface, borderRadius: 16, padding: "1.4rem" }}><Skeleton h={60} /></div>)
        ) : error ? (
          <div style={{ gridColumn: "1/-1", color: "#FF3B30", fontSize: 14, padding: "1rem 0" }}>{error}</div>
        ) : <>
          <MetricCard label="Ventas Totales"      value={fmt(kpis?.ventas_totales)} />
          <MetricCard label="Productos"           value={kpis?.num_productos}        color={C.blue}  />
          <MetricCard label="Promedio Diario"     value={kpis?.promedio_diario}      />
          <MetricCard label="Precisión del Modelo" value={`${kpis?.precision_modelo}%`} color={C.green} />
        </>}
      </div>

      {/* Ventas por producto */}
      <Card>
        <div style={{ fontSize: "1.05rem", fontWeight: 600, color: C.ink, marginBottom: 4 }}>Ventas por Producto</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: "1.2rem" }}>Unidades vendidas totales por SKU</div>
        {loading ? <Skeleton /> : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data?.por_producto} margin={{ top: 4, right: 8, bottom: 40, left: 0 }}>
              <XAxis dataKey="producto" tick={{ fontSize: 11, fill: C.muted }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="ventas" radius={[6,6,0,0]}>
                {data?.por_producto?.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? C.blue : C.border} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Tendencia */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.2rem" }}>
          <div style={{ fontSize: "1.05rem", fontWeight: 600, color: C.ink }}>Tendencia de Ventas</div>
          <PillGroup options={["Diario","Semanal","Mensual"]} value={periodo} onChange={p => { setPeriodo(p); }} />
        </div>
        {loading ? <Skeleton /> : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data?.tendencia} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={false}
                tickFormatter={d => d.slice(5)} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="ventas" stroke={C.blue} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: C.blue }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Top 5 */}
      <Card>
        <div style={{ fontSize: "1.05rem", fontWeight: 600, color: C.ink, marginBottom: "1rem" }}>Top 5 Productos</div>
        {loading ? <Skeleton h={120} /> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left",  padding: "0.5rem 0.75rem", color: C.muted, fontWeight: 500, fontSize: 12, borderBottom: `1px solid ${C.border}` }}>#</th>
                <th style={{ textAlign: "left",  padding: "0.5rem 0.75rem", color: C.muted, fontWeight: 500, fontSize: 12, borderBottom: `1px solid ${C.border}` }}>Producto</th>
                <th style={{ textAlign: "right", padding: "0.5rem 0.75rem", color: C.muted, fontWeight: 500, fontSize: 12, borderBottom: `1px solid ${C.border}` }}>Ventas</th>
              </tr>
            </thead>
            <tbody>
              {data?.top_cinco?.map((row, i) => (
                <tr key={i} style={{ borderBottom: i < 4 ? `1px solid ${C.border}` : "none" }}>
                  <td style={{ padding: "0.75rem", color: C.muted, fontWeight: 600, fontSize: 12 }}>{i + 1}</td>
                  <td style={{ padding: "0.75rem", color: C.ink,  fontWeight: 500 }}>{row.producto}</td>
                  <td style={{ padding: "0.75rem", color: C.ink,  fontWeight: 700, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(row.ventas)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

// ── Tab: Predicción ───────────────────────────────────────────────
function Prediccion() {
  const [form, setForm] = useState({
    producto:    PRODUCTOS[0],
    fecha:       today(),
    temperatura: 25,
    clima:       CLIMAS[0],
    festivo:     false,
    horizonte:   "Diaria",
  });
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const horizMap = { Diaria: "diaria", Semanal: "semanal", Mensual: "mensual" };

  const predecir = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await apiFetch(`/predecir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, horizonte: horizMap[form.horizonte] }),
      });
      const json = await res.json();
      setResult(json);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 760 }}>
      <Card>
        {/* Header */}
        <div style={{ fontSize: 11, fontWeight: 700, color: C.blue, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 4 }}>
          IA · Inventario Inteligente
        </div>
        <div style={{ fontSize: "1.5rem", fontWeight: 700, color: C.ink, letterSpacing: "-0.03em", marginBottom: 4 }}>
          Predicción de Demanda
        </div>
        <div style={{ fontSize: 14, color: C.muted, marginBottom: "2rem" }}>
          Configura los parámetros para proyectar cuánto stock necesitarás.
        </div>

        {/* Form grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 2rem" }}>
          <div>
            <Select label="Producto"   value={form.producto}  onChange={v => set("producto", v)}  options={PRODUCTOS} />
            <Select label="Clima"      value={form.clima}     onChange={v => set("clima", v)}      options={CLIMAS}    />

            <div style={{ marginBottom: "1.2rem" }}>
              <Label>Fecha a predecir</Label>
              <input
                type="date"
                value={form.fecha}
                onChange={e => set("fecha", e.target.value)}
                style={{
                  width: "100%", padding: "0.6rem 0.9rem",
                  borderRadius: 10, border: `1.5px solid ${C.border}`,
                  background: C.bg, fontSize: 14, color: C.ink,
                  fontFamily: "inherit", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          <div>
            {/* Temperatura */}
            <div style={{ marginBottom: "1.2rem" }}>
              <Label>Temperatura — {form.temperatura} °C</Label>
              <input
                type="range" min={0} max={40} value={form.temperatura}
                onChange={e => set("temperatura", Number(e.target.value))}
                style={{ width: "100%", accentColor: C.blue, cursor: "pointer" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.muted, marginTop: 2 }}>
                <span>0 °C</span><span>40 °C</span>
              </div>
            </div>

            {/* Horizonte */}
            <div style={{ marginBottom: "1.2rem" }}>
              <Label>Horizonte</Label>
              <PillGroup
                options={["Diaria","Semanal","Mensual"]}
                value={form.horizonte}
                onChange={v => set("horizonte", v)}
              />
            </div>

            {/* Festivo */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: "0.5rem" }}>
              <div
                onClick={() => set("festivo", !form.festivo)}
                style={{
                  width: 44, height: 26, borderRadius: 13, cursor: "pointer",
                  background: form.festivo ? C.blue : C.border,
                  position: "relative", transition: "background .2s",
                }}
              >
                <div style={{
                  position: "absolute", top: 3,
                  left: form.festivo ? 21 : 3,
                  width: 20, height: 20, borderRadius: "50%",
                  background: "#FFF", transition: "left .2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }} />
              </div>
              <span style={{ fontSize: 14, color: C.ink, fontWeight: 500 }}>Día festivo</span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: C.border, margin: "1.5rem 0" }} />

        {/* Botón */}
        <button
          onClick={predecir}
          disabled={loading}
          style={{
            width: "100%", padding: "0.8rem",
            background: loading ? C.border : C.blue,
            color: loading ? C.muted : "#FFF",
            border: "none", borderRadius: 12, fontSize: 15,
            fontWeight: 600, fontFamily: "inherit", cursor: loading ? "default" : "pointer",
            letterSpacing: "-0.01em", transition: "all .2s",
            boxShadow: loading ? "none" : "0 2px 8px rgba(0,113,227,0.3)",
          }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}
        >
          {loading ? "Calculando…" : "Calcular Demanda →"}
        </button>

        {error && (
          <div style={{ marginTop: "1rem", fontSize: 13, color: "#FF3B30" }}>{error}</div>
        )}
      </Card>

      {/* Resultado */}
      {result && (
        <div style={{
          background: `linear-gradient(135deg, ${C.blue} 0%, #0077ED 100%)`,
          borderRadius: 20, padding: "2rem 2.2rem", color: "#FFF",
          animation: "fadeUp .35s ease",
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Demanda proyectada · {form.horizonte}
          </div>
          <div style={{ fontSize: "3rem", fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1 }}>
            {fmt(result.demanda)}
            <span style={{ fontSize: "1rem", fontWeight: 400, opacity: 0.75, marginLeft: 8 }}>unidades</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginTop: "1.4rem" }}>
            {[
              { label: "Stock recomendado",  value: fmt(result.stock)  },
              { label: "Margen de seguridad", value: fmt(result.margen) },
            ].map(({ label, value }) => (
              <div key={label} style={{
                background: "rgba(255,255,255,0.15)",
                borderRadius: 14, padding: "1rem 1.2rem",
              }}>
                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: "1.7rem", fontWeight: 700, letterSpacing: "-0.03em" }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers CSV ───────────────────────────────────────────────────
function exportCSV(rows, horizonte, fecha) {
  const header = "Producto,Demanda,Stock Recomendado,Margen de Seguridad";
  const lines  = rows.map(r =>
    `${r.producto},${r.demanda},${r.stock},${r.margen}`
  );
  const blob = new Blob(
    [`${header}\n${lines.join("\n")}`],
    { type: "text/csv;charset=utf-8;" }
  );
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = `orion_pedido_${horizonte}_${fecha}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ── Tab: Pedido ───────────────────────────────────────────────────
function Pedido() {
  const [form, setForm] = useState({
    fecha:       new Date().toISOString().slice(0, 10),
    temperatura: 25,
    clima:       CLIMAS[0],
    festivo:     false,
    horizonte:   "Diaria",
  });
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const horizMap = { Diaria: "diaria", Semanal: "semanal", Mensual: "mensual" };

  const calcular = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res  = await apiFetch(`/predecir-lote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, horizonte: horizMap[form.horizonte] }),
      });
      setResult(await res.json());
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  // Color de alerta por margen
  const alertColor = (margen, demanda) => {
    const pct = demanda > 0 ? margen / demanda : 0;
    if (pct >= 0.18) return C.green;
    if (pct >= 0.10) return "#FF9F0A";
    return "#FF3B30";
  };

  return (
    <div>
      {/* Formulario */}
      <Card>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.blue, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 4 }}>
          IA · Pedido Inteligente
        </div>
        <div style={{ fontSize: "1.5rem", fontWeight: 700, color: C.ink, letterSpacing: "-0.03em", marginBottom: 4 }}>
          Pedido en Lote
        </div>
        <div style={{ fontSize: 14, color: C.muted, marginBottom: "1.8rem" }}>
          Genera la demanda proyectada para los {PRODUCTOS.length} productos de un jalón.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0 2rem", alignItems: "end" }}>
          {/* Fecha */}
          <div>
            <Label>Fecha de referencia</Label>
            <input
              type="date" value={form.fecha}
              onChange={e => set("fecha", e.target.value)}
              style={{
                width: "100%", padding: "0.6rem 0.9rem",
                borderRadius: 10, border: `1.5px solid ${C.border}`,
                background: C.bg, fontSize: 14, color: C.ink,
                fontFamily: "inherit", outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          {/* Clima */}
          <div>
            <Select label="Clima" value={form.clima} onChange={v => set("clima", v)} options={CLIMAS} />
          </div>

          {/* Temperatura */}
          <div>
            <Label>Temperatura — {form.temperatura} °C</Label>
            <input
              type="range" min={0} max={40} value={form.temperatura}
              onChange={e => set("temperatura", Number(e.target.value))}
              style={{ width: "100%", accentColor: C.blue, cursor: "pointer", marginTop: 6 }}
            />
          </div>

          {/* Horizonte + Festivo */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <Label>Horizonte</Label>
              <PillGroup
                options={["Diaria","Semanal","Mensual"]}
                value={form.horizonte}
                onChange={v => set("horizonte", v)}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                onClick={() => set("festivo", !form.festivo)}
                style={{
                  width: 40, height: 24, borderRadius: 12, cursor: "pointer",
                  background: form.festivo ? C.blue : C.border,
                  position: "relative", transition: "background .2s", flexShrink: 0,
                }}
              >
                <div style={{
                  position: "absolute", top: 2,
                  left: form.festivo ? 18 : 2,
                  width: 20, height: 20, borderRadius: "50%",
                  background: "#FFF", transition: "left .2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }} />
              </div>
              <span style={{ fontSize: 13, color: C.ink, fontWeight: 500 }}>Día festivo</span>
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: C.border, margin: "1.5rem 0" }} />

        <button
          onClick={calcular} disabled={loading}
          style={{
            width: "100%", padding: "0.8rem",
            background: loading ? C.border : C.blue,
            color: loading ? C.muted : "#FFF",
            border: "none", borderRadius: 12, fontSize: 15,
            fontWeight: 600, fontFamily: "inherit",
            cursor: loading ? "default" : "pointer",
            letterSpacing: "-0.01em", transition: "all .2s",
            boxShadow: loading ? "none" : "0 2px 8px rgba(0,113,227,0.3)",
          }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}
        >
          {loading ? "Calculando todos los productos…" : `Generar Pedido ${form.horizonte} →`}
        </button>

        {error && <div style={{ marginTop: "1rem", fontSize: 13, color: "#FF3B30" }}>{error}</div>}
      </Card>

      {/* Resultados */}
      {result && (
        <div style={{ animation: "fadeUp .35s ease" }}>

          {/* Resumen totales */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
            <MetricCard label={`Demanda Total · ${form.horizonte}`} value={fmt(result.total_demanda)} color={C.blue} />
            <MetricCard label="Stock Total Recomendado"             value={fmt(result.total_stock)} />
            <MetricCard label="Productos Analizados"                value={result.productos.length} />
          </div>

          {/* Tabla */}
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <div style={{ fontSize: "1.05rem", fontWeight: 600, color: C.ink }}>
                Detalle por Producto
              </div>
              <button
                onClick={() => exportCSV(result.productos, horizMap[form.horizonte], form.fecha)}
                style={{
                  padding: "0.45rem 1rem", borderRadius: 9,
                  border: `1.5px solid ${C.border}`,
                  background: C.surface, color: C.ink,
                  fontSize: 13, fontWeight: 500, fontFamily: "inherit",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                  transition: "all .18s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = C.bg; }}
                onMouseLeave={e => { e.currentTarget.style.background = C.surface; }}
              >
                ↓ Exportar CSV
              </button>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr>
                  {["Producto","Demanda","Stock Recomendado","Margen","Estado"].map(h => (
                    <th key={h} style={{
                      textAlign: h === "Producto" ? "left" : "right",
                      padding: "0.5rem 0.75rem", color: C.muted,
                      fontWeight: 500, fontSize: 11,
                      borderBottom: `1px solid ${C.border}`,
                      textTransform: "uppercase", letterSpacing: "0.05em",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.productos.map((row, i) => {
                  const pct    = row.demanda > 0 ? row.margen / row.demanda : 0;
                  const estado = pct >= 0.18 ? "Óptimo" : pct >= 0.10 ? "Ajustado" : "Crítico";
                  const color  = alertColor(row.margen, row.demanda);
                  return (
                    <tr key={i} style={{ borderBottom: i < result.productos.length - 1 ? `1px solid ${C.border}` : "none" }}>
                      <td style={{ padding: "0.85rem 0.75rem", color: C.ink, fontWeight: 500 }}>{row.producto}</td>
                      <td style={{ padding: "0.85rem 0.75rem", color: C.ink, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{fmt(row.demanda)}</td>
                      <td style={{ padding: "0.85rem 0.75rem", color: C.ink, fontVariantNumeric: "tabular-nums", textAlign: "right", fontWeight: 600 }}>{fmt(row.stock)}</td>
                      <td style={{ padding: "0.85rem 0.75rem", color: C.muted, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{fmt(row.margen)}</td>
                      <td style={{ padding: "0.85rem 0.75rem", textAlign: "right" }}>
                        <span style={{
                          fontSize: 12, fontWeight: 600, color,
                          background: `${color}18`,
                          padding: "3px 10px", borderRadius: 20,
                        }}>
                          {estado}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
}

// ── Acceso ─────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "No fue posible iniciar sesión.");
      sessionStorage.setItem("orion_token", data.access_token);
      sessionStorage.setItem("orion_user", data.username);
      onLogin(data.username);
    } catch (err) {
      setError(err.message || "No se pudo conectar con Orión API. Verifica que el backend esté activo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-panel">
        <div className="login-brand">ORI<span>Ó</span>N <small>ONE</small></div>
        <div className="login-kicker">INTELLIGENCE PLATFORM</div>
        <h1>Bienvenido de nuevo</h1>
        <p className="login-subtitle">Inicia sesión para acceder a tu centro de inteligencia empresarial.</p>
        <form onSubmit={submit}>
          <label htmlFor="orion-user">Usuario</label>
          <input id="orion-user" autoComplete="username" value={username}
            onChange={e => setUsername(e.target.value)} placeholder="Ingresa tu usuario" required />
          <label htmlFor="orion-password">Contraseña</label>
          <div className="password-wrap">
            <input id="orion-password" type={showPassword ? "text" : "password"}
              autoComplete="current-password" value={password}
              onChange={e => setPassword(e.target.value)} placeholder="Ingresa tu contraseña" required />
            <button type="button" className="show-password" onClick={() => setShowPassword(v => !v)}>
              {showPassword ? "Ocultar" : "Mostrar"}
            </button>
          </div>
          {error && <div className="login-error" role="alert">{error}</div>}
          <button className="login-submit" type="submit" disabled={loading}>
            {loading ? "Verificando acceso…" : "Iniciar sesión"}
            {!loading && <span>→</span>}
          </button>
        </form>
        <div className="login-footer"><span className="status-dot" /> SISTEMA DE ACCESO PROTEGIDO</div>
      </div>
      <div className="login-side">
        <div className="orb orb-one" /><div className="orb orb-two" />
        <div className="side-content">
          <div className="side-tag">ORIÓ N ONE · BUSINESS INTELLIGENCE</div>
          <h2>Decisiones inteligentes.<br /><em>Resultados extraordinarios.</em></h2>
          <p>Transforma tus datos en conocimiento, anticipa la demanda y toma mejores decisiones de inventario.</p>
          <div className="side-line" />
          <div className="side-caption">PREDICTIVE ANALYTICS · INVENTORY INTELLIGENCE</div>
        </div>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("Dashboard");
  const [user, setUser] = useState(() => sessionStorage.getItem("orion_token")
    ? sessionStorage.getItem("orion_user") || "admin" : "");

  useEffect(() => {
    const expired = () => setUser("");
    window.addEventListener("orion-session-expired", expired);
    return () => window.removeEventListener("orion-session-expired", expired);
  }, []);

  const logout = () => {
    sessionStorage.removeItem("orion_token");
    sessionStorage.removeItem("orion_user");
    setUser("");
    setTab("Dashboard");
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.bg}; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
               -webkit-font-smoothing: antialiased; }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        .login-shell{min-height:100vh;display:grid;grid-template-columns: minmax(390px, 0.85fr) 1.15fr;background:#f5f7fb;color:#172033}
        .login-panel{display:flex;flex-direction:column;justify-content:center;width:100%;max-width:470px;margin:auto;padding:64px 54px}
        .login-brand{font-size:27px;font-weight:800;letter-spacing:-1.5px;color:#15213a}.login-brand span{color:#1674e8}.login-brand small{font-size:11px;letter-spacing:3px;margin-left:7px;color:#8b96a8}
        .login-kicker{font-size:9px;letter-spacing:2.8px;color:#8b96a8;font-weight:700;margin-top:9px;margin-bottom:58px}
        .login-panel h1{font-size:32px;letter-spacing:-1.1px;margin-bottom:10px;color:#172033}.login-subtitle{font-size:13px;line-height:1.7;color:#788397;margin-bottom:35px}
        .login-panel form label{display:block;font-size:11px;font-weight:700;color:#39465b;margin:18px 0 8px}
        .login-panel input{width:100%;height:48px;border:1px solid #dfe5ee;border-radius:9px;background:white;padding:0 14px;font:13px Inter,sans-serif;outline:none;transition:.2s}
        .login-panel input:focus{border-color:#1674e8;box-shadow:0 0 0 3px #1674e81a}
        .password-wrap{position:relative}.password-wrap input{padding-right:78px}.show-password{position:absolute;right:10px;top:50%;transform:translateY(-50%);border:0;background:none;color:#1674e8;font-size:10px;font-weight:700;cursor:pointer}
        .login-submit{height:49px;width:100%;border:0;border-radius:9px;background:#176fe0;color:white;font:600 13px Inter,sans-serif;margin-top:25px;cursor:pointer;box-shadow:0 8px 18px #176fe033;transition:.2s}.login-submit:hover{background:#0f60c8;transform:translateY(-1px)}.login-submit:disabled{opacity:.65;cursor:wait}.login-submit span{float:right;margin-right:13px;font-size:18px;line-height:12px}
        .login-error{font-size:12px;color:#c53030;background:#fff0f0;border:1px solid #ffd5d5;padding:10px 12px;border-radius:8px;margin-top:14px}
        .login-footer{font-size:9px;letter-spacing:1.5px;color:#9aa4b3;font-weight:700;margin-top:62px;display:flex;align-items:center;gap:9px}.status-dot{width:7px;height:7px;background:#31b879;border-radius:50%;box-shadow:0 0 0 4px #31b8791c}
        .login-side{position:relative;overflow:hidden;display:flex;align-items:center;background:linear-gradient(140deg,#0b1e3d,#102f5c 58%,#1266b6);padding:10%;color:white}
        .login-side:after{content:"";position:absolute;inset:0;background:linear-gradient(120deg,transparent 35%,#ffffff08 35.2%,transparent 35.5%),radial-gradient(circle at 80% 20%,#268bdf38,transparent 40%)}
        .side-content{position:relative;z-index:1;max-width:620px}.side-tag{font-size:9px;letter-spacing:3px;color:#8ebff5;font-weight:700;margin-bottom:28px}.side-content h2{font-size:clamp(30px,4vw,52px);line-height:1.14;letter-spacing:-2px;font-weight:650}.side-content h2 em{font-style:normal;color:#72b8ff}.side-content p{max-width:430px;font-size:14px;line-height:1.9;color:#c0d1e6;margin-top:24px}.side-line{width:46px;height:2px;background:#61adf8;margin-top:45px}.side-caption{font-size:9px;letter-spacing:2px;color:#86a9ce;margin-top:18px}
        .orb{position:absolute;border:1px solid #ffffff16;border-radius:50%;width:460px;height:460px;right:-150px;top:-150px}.orb-two{width:680px;height:680px;right:-260px;top:-260px}
        @media(max-width:850px){.login-shell{grid-template-columns:1fr}.login-panel{padding:55px 28px;max-width:520px}.login-kicker{margin-bottom:38px}.login-side{display:none}}
      `}</style>
      {!user ? <Login onLogin={setUser} /> : (
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem 2.5rem 4rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2.5rem", gap: 16 }}>
            <div style={{ fontSize: "1.35rem", fontWeight: 700, color: C.ink, letterSpacing: "-0.02em" }}>
              Orión One<span style={{ color: C.blue }}>.</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <PillGroup options={["Dashboard","Predicción","Pedido"]} value={tab} onChange={setTab} />
              <button onClick={logout} title="Cerrar sesión" style={{border:"1px solid #e4e7ec",background:"#fff",borderRadius:9,padding:"9px 12px",fontSize:12,color:"#596579",cursor:"pointer"}}>Salir ↗</button>
            </div>
          </div>
          {tab === "Dashboard" && <Dashboard />}
          {tab === "Predicción" && <Prediccion />}
          {tab === "Pedido" && <Pedido />}
        </div>
      )}
    </>
  );
}
