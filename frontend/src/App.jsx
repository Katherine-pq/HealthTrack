import { useEffect, useState } from "react";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Device from "./pages/Device";
import { getCurrentUser } from "./service/authService";
import "./styles.css";

// Coordina la sesión y decide qué pantalla mostrar.
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [path, setPath] = useState(location.pathname);
  const [notice, setNotice] = useState("");
  function navigate(next, message = "") {
    history.pushState({}, "", next);
    setPath(next);
    setNotice(message);
  }
  useEffect(() => {
    const pop = () => {
      setPath(location.pathname);
      setNotice("");
    };
    window.addEventListener("popstate", pop);
    getCurrentUser()
      .then(setUser)
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    if (loading) return;
    const next = user
      ? path === "/device"
        ? "/device"
        : "/dashboard"
      : path === "/register"
        ? "/register"
        : "/login";
    if (path !== next) {
      history.replaceState({}, "", next);
      setPath(next);
    }
  }, [user, loading, path]);
  if (loading) return <div className="loading">Cargando HealthTrack…</div>;
  const Page = path === "/device" ? Device : Dashboard;
  if (user)
    return (
      <Page
        navigate={navigate}
        user={user}
        onLogout={() => {
          setUser(null);
          navigate("/login", "Has cerrado sesión correctamente.");
        }}
      />
    );
  if (path === "/register") return <Register navigate={navigate} />;
  return <Login onUser={setUser} navigate={navigate} notice={notice} />;
}
