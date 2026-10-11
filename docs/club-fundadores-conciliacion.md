# Club Costa Mar — Reporte de conciliación "Primeros 50 Fundadores"

Fecha del reporte: 2026-10-11
Estado: **BORRADOR — pendiente de aprobación manual. NO se han emitido cupones.**

## Regla de prioridad (provisional, a confirmar)
Se usa `club_members.enrolled_at` (valor original, no se modifica) como
referencia histórica de "inscripción completada", ordenado ascendente.

## Socios existentes (4) y su prioridad

| Prioridad | Código     | Nombre                      | Teléfono | Fecha nac. | Tel. verif. | enrolled_at (UTC)            |
|-----------|------------|-----------------------------|----------|------------|-------------|------------------------------|
| 1         | CM-RBVR70  | DIEGO CABRERA               | Sí       | **No**     | No          | 2026-10-11 06:06:17          |
| 2         | CM-U99OW2  | Diego Alonso Cabrera Rios   | Sí       | **No**     | No          | 2026-10-11 06:07:54          |
| 3         | CM-Z0L7TN  | Costa Mar Barra Cevichera   | **No**   | **No**     | No          | 2026-10-11 06:49:34          |
| 4         | CM-SK6B3B  | Naysha Amones               | Sí       | **No**     | No          | 2026-10-11 14:04:26          |

## Observaciones / bloqueos para emitir
- **Ninguno tiene fecha de nacimiento** todavía (se agregó el campo hoy). No se
  puede validar mayoría de edad hasta que completen su perfil.
- CM-Z0L7TN (parece una cuenta de la marca, no un cliente) **no tiene teléfono**
  y probablemente deba excluirse de la campaña de fundadores.
- `phone_verified = false` en todos (OTP diferido por decisión de negocio).
- Hay dos registros con nombre "Diego Cabrera" (CM-RBVR70 y CM-U99OW2):
  revisar si son la misma persona con dos cuentas Google antes de asignar,
  para no entregar dos cupones a un mismo titular.

## Requisitos antes de emitir (según reglas aprobadas)
Para asignar un cupón de fundador, cada socio debe cumplir:
1. Perfil completo (nombre, teléfono, fecha de nacimiento).
2. Mayoría de edad (≥18, validada en backend, TZ America/Santiago).
3. (Cuando exista OTP) teléfono verificado — hoy diferido.

## Recomendación
NO emitir cupones de fundadores aún. Pasos sugeridos:
1. Que los socios existentes completen su perfil (fecha de nacimiento).
2. Resolver el posible duplicado de "Diego Cabrera".
3. Decidir si la cuenta de la marca se excluye.
4. Confirmar la regla final de prioridad.
5. Recién entonces, emitir los cupones mediante la operación transaccional
   idempotente (tope 50), que se implementará en Fase 2 con tu aprobación.
