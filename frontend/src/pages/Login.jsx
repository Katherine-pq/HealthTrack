import { useState } from "react";
import AuthLayout from "../components/AuthLayout";
import PasswordField from "../components/PasswordField";
import { login } from "../service/authService";

export default function Login({ onUser, navigate, notice }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setError("");
    const data = Object.fromEntries(new FormData(event.target));
    setBusy(true);
    try {
      const user = await login({ email: data.email, password: data.password });
      onUser(user);
      navigate("/dashboard");
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "No pudimos conectar. Inténtalo nuevamente."
          : err.message,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthLayout navigate={navigate}>
      {notice && (
        <div role="status" className="success">
          {notice}
        </div>
      )}
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
      <form onSubmit={submit}>
        <label>
          Correo electrónico
          <input
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            placeholder="tu.nombre@ejemplo.com"
          />
        </label>
        <PasswordField />
        <button className="primary" disabled={busy}>
          {busy ? "Procesando…" : "Iniciar sesión"} <span>→</span>
        </button>
      </form>
    </AuthLayout>
  );
}
