import { useEffect, useState } from "react";
import AppLayout from "../components/AppLayout";
import { getDashboard, syncDevice } from "../service/deviceService";

export default function Dashboard(props) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  async function load() {
    setError("");
    try {
      setData(await getDashboard());
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function sync() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await syncDevice();
      setNotice(result.message);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const latest = data?.latest;
  const device = data?.device;
  const stats = [
    ["♥", "Ritmo cardíaco", latest?.heart_rate, "ppm", "#f34468"],
    ["↗", "Pasos", latest?.steps?.toLocaleString("es-PE"), "pasos", "#2863f5"],
    ["♨", "Calorías quemadas", latest?.calories, "kcal", "#ef9b00"],
    [
      "☾",
      "Tiempo de sueño",
      latest
        ? `${Math.floor(latest.sleep_minutes / 60)}h ${latest.sleep_minutes % 60}m`
        : null,
      "",
      "#9145ee",
    ],
  ];
  const metrics = data?.metrics || [];
  const maximum = Math.max(1, ...metrics.map((row) => row.steps));
  return (
    <AppLayout {...props} active="dashboard">
      <div className="page-heading">
        <div>
          <span className="overline">TU RESUMEN PERSONAL</span>
          <h1>¡Hola, {props.user.name.split(" ")[0]}!</h1>
          <p>
            {latest
              ? `Último registro: ${latest.date} · Simulación`
              : "Registra un dispositivo y sincroniza para ver tus métricas."}
          </p>
        </div>
      </div>
      <div className="demo-banner">
        <span>ⓘ</span>
        <div>
          <b>Métricas de simulación</b>
          <p>
            Estos valores ficticios se consultan desde tu base de datos. No son
            mediciones reales ni recomendaciones médicas.
          </p>
        </div>
        <span className="demo-tag">DATOS SIMULADOS</span>
      </div>
      {error && (
        <div role="alert" className="error">
          {error}{" "}
          <button onClick={load} disabled={busy}>
            Reintentar
          </button>
        </div>
      )}
      {notice && (
        <div role="status" className="success">
          {notice}
        </div>
      )}
      {!data ? (
        !error && <p role="status">Cargando tus datos…</p>
      ) : (
        <>
          <section className="stats-grid" aria-label="Métricas guardadas">
            {stats.map(([icon, label, value, unit, color]) => (
              <article className="stat-card" key={label}>
                <div className="stat-top">
                  <span
                    className="metric-icon"
                    style={{ color, background: color + "12" }}
                  >
                    {icon}
                  </span>
                  <div>
                    <p>{label}</p>
                    <b>{value ?? "—"}</b>{" "}
                    <small>{value != null ? unit : "Sin datos"}</small>
                  </div>
                </div>
                <p className="panel-description">
                  {latest
                    ? "Último día sincronizado"
                    : "Pendiente de sincronización"}
                </p>
              </article>
            ))}
          </section>
          <div className="dashboard-columns">
            <section className="panel activity">
              <div className="panel-heading">
                <h2>Pasos de los últimos días</h2>
                <span className="chart-badge">Simulación</span>
              </div>
              <p className="panel-description">
                Cada barra representa un registro guardado en PostgreSQL.
              </p>
              {metrics.length ? (
                <div
                  className="daily-bars"
                  role="img"
                  aria-label={metrics
                    .map((row) => `${row.date}: ${row.steps} pasos`)
                    .join("; ")}
                >
                  {metrics.map((row) => (
                    <div className="daily-bar" key={row.date}>
                      <span>{row.steps.toLocaleString("es-PE")}</span>
                      <div className="bar-track">
                        <div
                          style={{ height: `${(row.steps / maximum) * 100}%` }}
                        />
                      </div>
                      <small>
                        {row.date.slice(8)}/{row.date.slice(5, 7)}
                      </small>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <h3>Aún no hay métricas</h3>
                  <p>
                    {device
                      ? "Sincroniza datos de prueba para llenar tu panel."
                      : "Primero registra tu dispositivo simulado."}
                  </p>
                  <button
                    className="secondary-action"
                    onClick={() => props.navigate("/device")}
                  >
                    Ir a Dispositivo →
                  </button>
                </div>
              )}
            </section>
            <div className="right-panels">
              <section className="panel">
                <div className="panel-heading">
                  <h2>Mi dispositivo</h2>
                  <span className="neutral-tag">
                    {device ? "Simulado" : "Sin registrar"}
                  </span>
                </div>
                <div className="device-placeholder">
                  <span className="watch">⌚</span>
                  <b>{device?.name || "Tu próximo paso"}</b>
                  <p>
                    {device
                      ? `${device.brand} · ${device.model}`
                      : "Registra un dispositivo para comenzar."}
                  </p>
                </div>
                {device && (
                  <>
                    <p className="panel-description">
                      Última sincronización:{" "}
                      {device.last_synced_at
                        ? new Date(device.last_synced_at).toLocaleString(
                            "es-PE",
                          )
                        : "Sin sincronizar"}
                    </p>
                    <button className="primary" disabled={busy} onClick={sync}>
                      {busy ? "Sincronizando…" : "Sincronizar datos de prueba"}
                    </button>
                  </>
                )}
                <button
                  className="secondary-action"
                  onClick={() => props.navigate("/device")}
                >
                  {device ? "Ver dispositivo" : "Registrar dispositivo"} →
                </button>
              </section>
              <section className="panel account-panel">
                <span className="small-heading">MI CUENTA</span>
                <h2>{props.user.name}</h2>
                <div className="email-line">{props.user.email}</div>
                <span className="account-status">
                  <i /> Sesión iniciada
                </span>
              </section>
            </div>
          </div>
        </>
      )}
    </AppLayout>
  );
}
