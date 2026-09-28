async function requestAuth(path, data) {
  const response = await fetch("/api/auth/" + path, {
    method: data === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok)
    throw new Error(
      typeof body.detail === "string"
        ? body.detail
        : "Revisa los datos ingresados. La contraseña debe tener al menos 8 caracteres.",
    );
  return body;
}

// Todas las peticiones de cuenta se realizan aquí, no en los componentes visuales.
export const register = (data) => requestAuth("register", data);
export const login = (data) => requestAuth("login", data);
export const getCurrentUser = () => requestAuth("me");
export const logout = () => requestAuth("logout", {});
