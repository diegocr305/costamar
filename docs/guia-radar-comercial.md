# Guía de uso del Radar Comercial

Para el dueño y la administradora. Entrar con Google en
[Admin](https://admin.restaurantecostamar.cl) y abrir Radar comercial.
El rol admin permite usar Radar; Equipo y accesos y la configuración exclusiva
de superadministrador permanecen restringidos. El correo del Radar sigue apagado.

## Rutina de revisión

1. Mirar la última revisión y los errores de sincronización. Una fecha antigua
   o un aviso de fuente fallida indica que los datos necesitan revisión.
2. Revisar Mi Radar: primero las coincidencias y oportunidades seguidas; después
   «Por revisar». Allí pueden quedar compras mixtas o títulos ambiguos.
3. Abrir General diario. Consultar Compra Ágil y licitaciones por separado;
   buscar también colación, alimentación, coffee, café, catering y almuerzo.
   General diario incluye procesos de cualquier rubro que siguen publicados,
   aunque se hayan publicado otro día.
4. En Compra Ágil elegir Todo Chile o región del comprador. Licitaciones usa
   listado nacional. La región del comprador no acredita lugar de entrega.
5. Usar «Guardar y ver ficha» en una oportunidad de interés. Revisar requisitos,
   entrega, presupuesto, convocatoria y cierre en la ficha oficial antes de
   decidir si postular. Guardar permite seguirla aunque no coincida con el perfil.
6. Registrar una nota con la próxima acción y marcar favorito si conviene.
   Mantener actualizada la etapa comercial después de realizar la acción real.
   «Postulada» registra una postulación hecha manualmente en Mercado Público.

Los filtros ayudan a encontrar compras, pero no garantizan detectar toda la
alimentación ni cumplir requisitos. Una compra con vasos junto a coffee break
puede ir a revisión; una palabra de comida tampoco garantiza afinidad comercial.

## Cierres, notas y archivos

- Si la fuente no indica zona horaria, verificar el cierre oficial e ingresar
  fecha/hora de Chile. No tratar una hora ambigua como fecha confirmada.
- Notas, favoritos y seguimiento son compartidos entre dueño y administradora.
  Si aparece conflicto de edición, recargar y revisar lo guardado por la otra
  persona antes de repetir el cambio.
- Adjuntar bases descargadas del portal: PDF/DOCX/PNG/JPG, hasta 10 MB.
  Son archivos privados para revisión humana; no se analizan automáticamente.
- Una respuesta de fuente fallida no equivale a «no hay compras». Revisar el
  mensaje, la fecha de consulta y el aviso de cache desactualizada; reintentar
  después de la pausa indicada. No actualizar repetidamente para saltar límites.

## Prueba pendiente en producción

Con una sesión real, consultar ambas fuentes y guardar una oportunidad de interés.
Agregar una nota/favorito y comprobar que persistan al volver a entrar. Subir y
descargar un archivo de trabajo sin datos personales innecesarios. Registrar
cuál paso falló y el mensaje mostrado para corregirlo.

Despliegue, esquema nuevo, interfaz publicada y worker ya fueron comprobados.
Esta prueba confirma las operaciones autenticadas que esos checks no cubren.

Referencia técnica: [Radar comercial](radar-comercial.md).
