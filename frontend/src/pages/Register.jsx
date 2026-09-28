import { useState } from "react";
import AuthLayout from "../components/AuthLayout";
import PasswordField from "../components/PasswordField";
import { register } from "../service/authService";

export default function Register({ navigate }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setError("");
    const data = Object.fromEntries(new FormData(event.target));
    if (data.password !== data.confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      await register({
        name: data.name,
        email: data.email,
        password: data.password,
      });
      navigate("/login", "Tu cuenta está lista. Inicia sesión para continuar.");
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
    <AuthLayout register navigate={navigate}>
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
      <form onSubmit={submit}>
        <label>
          Nombre completo
          <input
            name="name"
            required
            minLength={2}
            maxLength={100}
            autoComplete="name"
            placeholder="Ej. Alex Rivera"
          />
        </label>
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
        <PasswordField confirm />
        <PasswordField label="Confirmar contraseña" name="confirm" confirm />
        <p className="field-note">
          Usa al menos 8 caracteres. Puedes combinar letras, números y símbolos.
        </p>
        <button className="primary" disabled={busy}>
          {busy ? "Procesando…" : "Crear mi cuenta"} <span>→</span>
        </button>
      </form>
    </AuthLayout>
  );
}
