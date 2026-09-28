import { useState } from "react";
import Sidebar from "./Sidebar";
import { logout as logoutAccount } from "../service/authService";
export default function AppLayout({
  user,
  onLogout,
  navigate,
  active,
  children,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setBusy(true);
    try {
      await logoutAccount();
      onLogout();
    } catch {
      setError("No se pudo cerrar la sesión. Inténtalo nuevamente.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="dashboard">
      <Sidebar active={active} navigate={navigate} />
      <div className="dashboard-body">
        <header className="topbar">
          <span className="top-brand">
            HealthTrack <small>/ Mi panel</small>
          </span>
          <div className="account">
            <span className="avatar">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <b>{user.name}</b>
              <small>Cuenta personal</small>
            </div>
            <button className="logout" disabled={busy} onClick={logout}>
              {busy ? "Saliendo…" : "Cerrar sesión"}
            </button>
          </div>
        </header>
        <nav className="mobile-nav" aria-label="Navegación móvil">
          <button onClick={() => navigate("/dashboard")}>Dashboard</button>
          <button onClick={() => navigate("/device")}>Dispositivo</button>
        </nav>
        <main className="dashboard-main">
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
