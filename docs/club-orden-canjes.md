# Canjes por mesa y folio

Implementado el 12 de octubre de 2026.

- Mesa es obligatoria; acepta número o nombre. `5` se registra como `Mesa 5`.
- Pedido/boleta y observación son opcionales y se guardan por separado.
- Cada canje tiene un folio único `CAN-000001`. La numeración puede tener saltos.
- La confirmación muestra folio, socio y mesa. El historial permite buscar el folio y muestra quién validó, fecha y productos.
- Debajo del escáner aparecen los últimos seis canjes del día en America/Santiago. Se actualizan al entrar, volver a la pestaña, confirmar un canje o pulsar Actualizar.
- Buscar mesa usa coincidencia exacta: Mesa 5 no incluye Mesa 50. Los registros antiguos conservan su referencia original, sin inferir una mesa; se pueden buscar en el historial.

## API y base de datos

`POST /club/staff/redeem`: `{code, tableLabel, products?, orderRef?, note?}`. Devuelve `{redeemed: true, redemption}` con folio y datos del registro. El funcionario se toma del JWT.

`GET /club/staff/redemptions/recent?tableLabel=5`: `{items,total,page:1,pageSize:6}` del día actual. Acceso limitado a superadmin/admin/manager/cashier.

Migración aplicada en Supabase: `20261012150217_club_redemption_table_folio.sql`. Mantiene RLS y RPC de uso exclusivo del backend. La validación del cupón y el registro de los campos ocurren en una misma transacción. Se conserva el contrato anterior de canje para compatibilidad durante el despliegue.

Validación: 55 pruebas de API, compilaciones de API/admin, prueba SQL con rollback (mesa obligatoria, campos opcionales, folio, filtro exacto, historial y doble canje) y revisión del flujo en navegador a 320, 390 y 1280 px.

## Despliegue

La base de datos ya está actualizada. En el servidor, actualizar el repositorio y ejecutar:

```bash
git pull origin main
./deploy.sh api admin
```

Reservas ya implementado con el mapa y reglas del dueño: ver
`docs/reservas-primera-version.md`. Operación del turno en
`docs/guia-equipo-atencion.md`.
