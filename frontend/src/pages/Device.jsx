import { useEffect, useState } from "react";
import AppLayout from "../components/AppLayout";
import {
  getDevice,
  registerDevice,
  syncDevice,
} from "../service/deviceService";

export default function Device(props) {
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function load() {
    setLoading(true);
    setError("");
    try {
      setDevice(await getDevice());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = Object.fromEntries(new FormData(event.target));
      setDevice(await registerDevice(data));
      setNotice(
        "Dispositivo registrado. Ya puedes sincronizar los datos de prueba.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function sync() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await syncDevice();
      setDevice((previous) => ({
        ...previous,
        last_synced_at: result.last_synced_at,
      }));
      setNotice(result.message);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AppLayout {...props} active="device">
      <div className="page-heading">
        <div>
          <span className="overline">MI ACTIVIDAD</span>
          <h1>Mi dispositivo</h1>
          <p>Registra tu wearable de demostración y comienza a explorar.</p>
        </div>
      </div>
      <div className="demo-banner">
        <span>ⓘ</span>
        <div>
          <b>Dispositivo simulado</b>
          <p>
            No se conecta a un reloj físico, Bluetooth ni a una API de
            fabricante. Las métricas son ficticias y se guardan en tu cuenta.
          </p>
        </div>
      </div>
      {error && (
        <div role="alert" className="error">
          {error}{" "}
          <button onClick={load} disabled={busy}>
            Volver a consultar
          </button>
        </div>
      )}
      {notice && (
        <div role="status" className="success">
          {notice}
        </div>
      )}
      {loading ? (
        <p role="status">Consultando tu dispositivo…</p>
      ) : device ? (
        <section className="panel device-form">
          <div className="panel-heading">
            <h2>{device.name}</h2>
            <span className="neutral-tag">Simulado</span>
          </div>
          <p>
            {device.brand} · {device.model}
          </p>
          <p>
            Última sincronización:{" "}
            {device.last_synced_at
              ? new Date(device.last_synced_at).toLocaleString("es-PE")
              : "Todavía no has sincronizado"}
          </p>
          <p>
            Se generan los últimos siete días según la fecha de Lima. Repetir la
            sincronización no duplica ni cambia los días guardados.
          </p>
          <button className="primary" onClick={sync} disabled={busy}>
            {busy ? "Sincronizando…" : "Sincronizar datos de prueba"}
          </button>
          <button
            className="secondary-action"
            onClick={() => props.navigate("/dashboard")}
          >
            Ver mi dashboard →
          </button>
        </section>
      ) : (
        !error && (
          <section className="panel device-form">
            <h2>Registra tu primer dispositivo</h2>
            <p>En este release puedes registrar un dispositivo por cuenta.</p>
            <form onSubmit={submit}>
              <label>
                Nombre del dispositivo
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder="Ej. Mi pulsera de prueba"
                />
              </label>
              <label>
                Marca
                <input
                  name="brand"
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder="Ej. HealthTrack Demo"
                />
              </label>
              <label>
                Modelo
                <input
                  name="model"
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder="Ej. FitBand Pro"
                />
              </label>
              <button className="primary" disabled={busy}>
                {busy ? "Guardando…" : "Registrar dispositivo simulado"}
              </button>
            </form>
          </section>
        )
      )}
    </AppLayout>
  );
}
