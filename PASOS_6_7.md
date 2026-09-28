# Dispositivo simulado y métricas

## Archivos creados

| Archivo | Función |
|---|---|
| frontend/src/pages/Device.jsx | Formulario de dispositivo y botón de sincronización. |
| frontend/src/components/AppLayout.jsx | Marco compartido, sesión, encabezado y navegación móvil. |
| frontend/src/service/deviceService.js | Peticiones de dispositivo y métricas al backend. |
| backend/app/auth.py | Funciones de sesión y protección de origen extraídas de main.py para reutilizarlas. |
| backend/app/models/device.py | Modelos PostgreSQL Device y DailyMetric. |
| backend/app/routes/__init__.py | Identifica el paquete de rutas de Python. |
| backend/app/routes/devices.py | Registro, consulta y simulación de métricas del usuario conectado. |
| tests/test_devices.py | Pruebas de integración y aislamiento de cuentas. |
| PASOS_6_7.md | Traza e instrucciones manuales. |

## Archivos modificados

- frontend/src/App.jsx: ruta /device protegida por sesión.
- frontend/src/components/Sidebar.jsx: navegación habilitada para Dashboard y Dispositivo.
- frontend/src/pages/Dashboard.jsx: consulta datos guardados y dibuja barras con sus valores; estados sin datos y reintento.
- frontend/src/styles.css: estilos del dispositivo, gráfico diario y navegación móvil.
- backend/app/main.py: reutiliza autenticación e incluye rutas nuevas antes de la ruta de React.
- README.md: alcance y documentación actualizados.

No se modificó docker-compose.yml ni .env. Se conserva el puerto 5433 para pgAdmin. No se eliminó ninguna cuenta existente. No hay cambios de credenciales. Se agregan las tablas devices y daily_metrics. Las pruebas crearon tres cuentas ficticias en total (dos de dispositivos y una de autenticación).

## Comprobaciones realizadas

- React compiló correctamente y la aplicación Docker se reconstruyó.
- tests/test_devices.py: pasó registro, validación, protección de sesión/origen, aislamiento entre cuentas, métricas persistidas y sincronización simultánea sin duplicados.
- tests/test_auth.py: pasó registro, login, sesión y logout.
- La revisión visual queda para la prueba manual de la usuaria.

## Prueba manual

1. Recarga http://localhost:5173 e inicia sesión. Antes de sincronizar se muestran guiones y Sin datos.
2. Abre Dispositivo. Registra nombre Mi pulsera, marca HealthTrack Demo y modelo FitBand Pro.
3. Debe aparecer la ficha marcada Simulado y el estado Sin sincronizar.
4. Pulsa Sincronizar datos de prueba. La primera vez debe informar siete registros nuevos.
5. Pulsa Ver mi dashboard. Deben aparecer las cuatro métricas y siete barras.
6. Recarga: las métricas deben conservarse.
7. Vuelve a sincronizar el mismo día: debe indicar cero registros nuevos y conservar valores.
8. En pgAdmin, clic derecho en Tables → Refresh para ver devices y daily_metrics.

Consulta de solo lectura (reemplaza 4 si tu usuario tiene otro identificador):

```sql
SELECT id, user_id, name, brand, model, source, last_synced_at
FROM public.devices
WHERE user_id = 4;

SELECT m.date, m.steps, m.calories, m.heart_rate,
       m.sleep_minutes, m.source
FROM public.daily_metrics AS m
JOIN public.devices AS d ON d.id = m.device_id
WHERE d.user_id = 4
ORDER BY m.date;
```

El dashboard muestra horas/minutos de sueño; la base almacena minutos. Un valor de 444 equivale a 7 horas y 24 minutos. La fecha mostrada por cada tarjeta corresponde al último día guardado. Los datos son de simulación, nunca mediciones reales.
