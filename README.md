# HealthTrack — Release 1

Aplicación monolítica con React compilado servido por FastAPI y PostgreSQL como persistencia. Las carpetas frontend y backend separan el código, pero Docker construye y ejecuta una sola aplicación (`app`) además de la base de datos (`db`).

## Ejecutar

Con Docker Desktop iniciado, desde la raíz:

```powershell
docker --context desktop-linux compose up -d --build
```

Abrir http://localhost:5173. Registro en `/register`, acceso en `/login`, panel en `/dashboard`, documentación API en `/docs`.

Para detener sin borrar datos:

```powershell
docker --context desktop-linux compose stop
```

Los usuarios y sesiones persisten en el volumen `pgdata`. No usar `down -v` para un reinicio normal.

## Alcance implementado

- Registro con nombre, correo único y contraseña de al menos ocho caracteres.
- Contraseñas protegidas con bcrypt y validación de datos en el servidor.
- Inicio de sesión con cookie HttpOnly/SameSite y vencimiento de ocho horas.
- Restauración de sesión al recargar y cierre de sesión que invalida el token.
- Dashboard personal con métricas ficticias persistidas en PostgreSQL y módulos futuros deshabilitados.
- Diseño responsive basado en las tres imágenes de `frontend/src/assets/prototype`.

La cuenta no tiene verificación por correo ni recuperación de contraseña. Google, Apple, passkeys, integración con dispositivos físicos, historial con filtros y metas no están implementados en esta etapa. Antes de publicar en nube faltan HTTPS, limitación de intentos, revisión de configuración y pruebas de despliegue. Las fuentes web tienen alternativa local sans-serif.

## Configuración

`backend/.env` se carga en Docker; Compose fija el host `db` y alinea el usuario, contraseña y nombre de base con el servicio PostgreSQL. Los valores locales por defecto son postgres/postgres/wearable_db. Configurar credenciales propias para nube. Cambiar variables no cambia automáticamente la contraseña de un volumen PostgreSQL ya inicializado.

## Desarrollo local opcional

Backend: instalar `backend/requirements.txt`, configurar PostgreSQL local en `backend/.env` y ejecutar `uvicorn app.main:app --reload` desde backend. Frontend: `npm ci` y `npm run dev` desde frontend. Vite reenvía `/api` a localhost:8000. El despliegue Docker sigue siendo una sola aplicación.

## Prueba de autenticación

Con la aplicación en ejecución: `python tests/test_auth.py`. Crea una cuenta ficticia con correo único y verifica errores de validación, duplicados, credenciales incorrectas, protección de origen, sesión y logout. Cada ejecución conserva su cuenta de prueba en la base local.

## Dónde encontrar cada parte

- `frontend/src/App.jsx`: coordina la sesión y las rutas.
- `frontend/src/pages/Login.jsx`: formulario y envío de inicio de sesión.
- `frontend/src/pages/Register.jsx`: formulario, confirmación de contraseña y envío de registro.
- `frontend/src/pages/Dashboard.jsx`: panel personal y cierre de sesión.
- `frontend/src/components/AuthLayout.jsx`: distribución visual compartida por login y registro.
- `frontend/src/components/Brand.jsx`: marca HealthTrack.
- `frontend/src/components/PasswordField.jsx`: campo para mostrar/ocultar la contraseña.
- `frontend/src/components/Sidebar.jsx`: menú del dashboard.
- `frontend/src/components/charts/Sparkline.jsx`: minigráficos del prototipo inicial; el dashboard actual utiliza barras calculadas con las métricas guardadas.
- `frontend/src/service/authService.js`: llamadas HTTP al backend.
- `frontend/src/styles.css`: estilos y adaptación a pantallas pequeñas.
- `frontend/src/main.jsx`: punto de entrada de React.
- `backend/app/main.py`: endpoints, comprobación de sesión y entrega del frontend compilado.
- `backend/app/models/account.py`: tablas de usuarios y sesiones.
- `backend/app/database.py` y `config.py`: conexión y configuración de PostgreSQL.

Recorrido del registro: Register.jsx → authService.js → backend/app/main.py → tabla users.

Para pgAdmin instalado en Windows: host 127.0.0.1, puerto 5433, base wearable_db. El puerto interno entre app y db sigue siendo 5432. Se conserva el cambio de puerto realizado manualmente para evitar interferencias con PostgreSQL de Windows.

El inventario de archivos eliminados está en CLEANUP.md. Los archivos vacíos no aumentaban significativamente el peso de la aplicación: se retiraron para que la estructura sea más fácil de entender. No se eliminaron node_modules ni venv porque son dependencias del entorno local.

## Dispositivo simulado y sincronización (pasos 6 y 7)

Cada cuenta admite un dispositivo de demostración (nombre, marca y modelo). No hay conexión Bluetooth ni API de un fabricante. Las tablas `devices` y `daily_metrics` se crean al iniciar la aplicación, conservando `users` y `login_sessions`.

- `GET /api/device`: dispositivo del usuario conectado.
- `POST /api/device`: registra el dispositivo (uno por cuenta).
- `POST /api/device/sync`: genera los siete últimos días según America/Lima, incluido hoy. La combinación dispositivo/fecha es única; los días existentes no se duplican ni se sobrescriben. last_synced_at registra el último intento exitoso, synced_at de cada métrica indica cuándo se insertó.
- `GET /api/dashboard`: dispositivo, última métrica y últimos siete días guardados, exclusivamente del usuario conectado.

Las métricas son totales diarios ficticios de pasos/calorías, frecuencia cardíaca ilustrativa y minutos de sueño. El día actual es un ejemplo de día completo, no una lectura en vivo. Se conserva el historial en la base aunque el dashboard solo muestra los siete últimos días.

Prueba automática: `python tests/test_devices.py`. Crea dos cuentas ficticias y verifica aislamiento, validaciones, estados vacíos, persistencia y sincronización concurrente. Las cuentas de prueba se conservan para inspección. Las pruebas técnicas no sustituyen la validación con usuarios de AA3.

Ver `PASOS_6_7.md` para el inventario de cambios y la prueba manual.
