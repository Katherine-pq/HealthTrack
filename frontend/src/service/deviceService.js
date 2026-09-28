async function request(path, data) {
  const response = await fetch("/api/" + path, {
    method: data === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(
      typeof body.detail === "string"
        ? body.detail
        : "Revisa los campos: deben tener entre 2 y 80 caracteres.",
    );
  return body;
}
export const getDevice = () => request("device");
export const registerDevice = (data) => request("device", data);
export const syncDevice = () => request("device/sync", {});
export const getDashboard = () => request("dashboard");
