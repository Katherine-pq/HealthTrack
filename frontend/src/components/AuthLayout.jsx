import Brand from "./Brand";

export default function AuthLayout({ register = false, navigate, children }) {
  return (
    <main className="auth-layout">
      <aside className="story">
        <Brand />
        <div className="story-content">
          <span className="eyebrow">
            <i /> TU BIENESTAR, EN UN SOLO LUGAR
          </span>
          <h1>
            {register ? (
              <>
                Comienza a monitorear tu salud de forma <em>inteligente.</em>
              </>
            ) : (
              <>
                Tu salud y rendimiento, <em>bajo control</em> en un solo lugar.
              </>
            )}
          </h1>
          <p>
            Conoce tu actividad, sigue tu descanso y descubre cómo avanzas cada
            día.
          </p>
          {register ? (
            <div className="benefits">
              <article>
                <span>↗</span>
                <div>
                  <b>Tu actividad, más clara</b>
                  <p>Pasos, calorías, ritmo cardíaco y descanso.</p>
                </div>
              </article>
              <article>
                <span>◎</span>
                <div>
                  <b>Un espacio para tu progreso</b>
                  <p>Una vista sencilla de tus hábitos diarios.</p>
                </div>
              </article>
            </div>
          ) : (
            <div className="wearable-preview">
              <div className="preview-heading">
                <span>⌚</span>
                <div>
                  <b>FitBand Pro</b>
                  <small>Vista de demostración</small>
                </div>
                <span className="sample-pill">Ejemplo</span>
              </div>
              <div className="mini-stats">
                <div>
                  <small>Ritmo cardíaco</small>
                  <b className="pink">
                    ♥ 72 <small>ppm</small>
                  </b>
                </div>
                <div>
                  <small>Pasos diarios</small>
                  <b className="cyan">8,432</b>
                </div>
                <div>
                  <small>Calorías</small>
                  <b className="yellow">
                    342 <small>kcal</small>
                  </b>
                </div>
              </div>
            </div>
          )}
        </div>
        <footer className="story-footer">
          <span>◈</span> Portal de Salud del Consumidor{" "}
          <small>Proyecto académico · Release 1</small>
        </footer>
      </aside>
      <section className="auth-main">
        <div className="auth-card">
          <span className="badge">
            {register ? "COMIENZA TU RECORRIDO" : "BIENVENIDO A HEALTHTRACK"}
          </span>
          <h2>{register ? "Crea tu cuenta" : "Bienvenido de nuevo"}</h2>
          <p className="subtitle">
            {register
              ? "Tu primer paso hacia una visión más clara de tu bienestar."
              : "Inicia sesión para acceder a tu panel personal."}
          </p>
          {children}
          <p className="switch-auth">
            {register ? "¿Ya tienes una cuenta?" : "¿Aún no tienes una cuenta?"}{" "}
            <a
              href={register ? "/login" : "/register"}
              onClick={(e) => {
                e.preventDefault();
                navigate(register ? "/login" : "/register");
              }}
            >
              {register ? "Inicia sesión" : "Regístrate aquí"}
            </a>
          </p>
          <div className="privacy-note">
            ♧{" "}
            {register
              ? "Para esta demostración puedes utilizar un nombre y correo ficticios."
              : "Tu sesión es personal. Cierra sesión al terminar en un equipo compartido."}
          </div>
        </div>
        <footer className="auth-footer">
          © {new Date().getFullYear()} HealthTrack · Salud y bienestar digital
        </footer>
      </section>
    </main>
  );
}
