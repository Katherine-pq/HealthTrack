import { useState } from "react";
export default function PasswordField({
  label = "Contraseña",
  name = "password",
  confirm = false,
}) {
  const [show, setShow] = useState(false);
  return (
    <label>
      {label}
      <div className="password-field">
        <input
          name={name}
          type={show ? "text" : "password"}
          required
          minLength={8}
          maxLength={72}
          autoComplete={confirm ? "new-password" : "current-password"}
          placeholder="Ingresa tu contraseña"
        />
        <button
          type="button"
          aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
          onClick={() => setShow(!show)}
        >
          {show ? "Ocultar" : "Ver"}
        </button>
      </div>
    </label>
  );
}
