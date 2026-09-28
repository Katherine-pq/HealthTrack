import Brand from "./Brand";
const icons = {
  grid: "▦",
  device: "⌚",
  chart: "↗",
  target: "◎",
  history: "◷",
  user: "♙",
};

export default function Sidebar({ active = "dashboard", navigate }) {
  return (
    <aside className="sidebar">
      <Brand />
      <nav aria-label="Navegación principal">
        {[
          ["grid", "Dashboard"],
          ["device", "Dispositivo"],
          ["chart", "Estadísticas"],
          ["target", "Metas"],
          ["history", "Historial"],
          ["user", "Perfil"],
        ].map(([icon, label], i) => (
          <button
            key={label}
            className={
              (i === 0 && active === "dashboard") ||
              (i === 1 && active === "device")
                ? "nav-active"
                : ""
            }
            disabled={i > 1}
            onClick={() => navigate(i === 0 ? "/dashboard" : "/device")}
            title={i > 1 ? "Disponible en una próxima etapa" : undefined}
          >
            <span>{icons[icon]}</span>
            {label}
            {i > 1 && <small>Pronto</small>}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <span className="status-dot" /> Release 1{" "}
        <small>Tu espacio de bienestar</small>
      </div>
    </aside>
  );
}
