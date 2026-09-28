# Limpieza y organización de vistas

Archivos eliminados (vacíos, duplicados o reemplazados por el Dockerfile de la raíz):

- `frontend\src\components\Navbar.jsx`
- `frontend\src\components\charts\HeartRateChart.jsx`
- `frontend\src\context\AuthContext.jsx`
- `frontend\src\hooks\useAuth.js`
- `frontend\src\hooks\useDeviceStats.js`
- `frontend\src\pages\DeviceStats.jsx`
- `frontend\src\pages\Users.jsx`
- `frontend\src\routes\AppRoutes.jsx`
- `frontend\src\service\api.js`
- `frontend\src\service\statsService.js`
- `backend\app\core\dependencies.py`
- `backend\app\core\security.py`
- `backend\app\models\device_stats.py`
- `backend\app\models\user.py`
- `backend\app\routes\auth.py`
- `backend\app\routes\device_stats.py`
- `backend\app\routes\users.py`
- `backend\app\schemas\device_stats.py`
- `backend\app\schemas\user.py`
- `backend\app\services\stats_service.py`
- `frontend/public/index.html`
- `frontend/Dockerfile`
- `backend/Dockerfile`
- `tmp/test_auth.py`
- `backend/app/core/__init__.py`
- `backend/app/routes/__init__.py`
- `backend/app/schemas/__init__.py`
- `backend/app/services/__init__.py`

Se conservan las imágenes del prototipo, configuración .env, dependencias locales y el volumen PostgreSQL. No se modifican cuentas existentes ni se elimina el volumen PostgreSQL. La prueba de autenticación crea una cuenta ficticia adicional y cierra su sesión.

## Archivos creados
- frontend/src/pages/Register.jsx
- frontend/src/components/AuthLayout.jsx
- frontend/src/components/Brand.jsx
- frontend/src/components/PasswordField.jsx
- frontend/src/components/charts/Sparkline.jsx
- CLEANUP.md

## Archivos modificados
- frontend/src/App.jsx
- frontend/src/pages/Login.jsx
- frontend/src/pages/Dashboard.jsx
- frontend/src/components/Sidebar.jsx
- frontend/src/service/authService.js
- frontend/src/main.jsx (formato)
- frontend/src/styles.css (formato, sin cambios de diseño)
- README.md
- .gitignore

Se mantiene docker-compose.yml con el puerto 5433 configurado por la usuaria. Los archivos backend/app/main.py, database.py, config.py y models/account.py conservan su implementación.

## Validación realizada
- Compilación de React dentro de Docker correcta.
- tests/test_auth.py: registro, validación, duplicados, credenciales incorrectas, origen, sesión y logout correctos.
- Dashboard comprobado en navegador con sesión conservada.
- Aplicación reconstruida y encendida en localhost:5173.
