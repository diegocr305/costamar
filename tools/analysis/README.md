# Análisis local de exportaciones de ventas Fudo

`fudo_sales.py` lee el CSV sin subirlo a ninguna API. Genera HTML/Markdown,
JSON agregado y CSV de meses, días, horas, canales y medios de pago.
Con matplotlib instalado añade gráficos SVG/PNG/PDF.

```powershell
python tools/analysis/fudo_sales.py 'docs/ai-context/Untitled spreadsheet - Ventas.csv' --output private-reports/ventas-fudo-2026-10-12
```

Opcional para gráficos, en el entorno Python elegido:

```powershell
python -m pip install matplotlib
```

`private-reports/` y el CSV entregado por el dueño están en `.gitignore`.
No guardar resultados reales en `docs/` ni subirlos a GitHub. La herramienta
versionada no contiene cifras, nombres ni registros reales del restaurante.

## Criterios

- Suma monetaria exacta con Decimal; presentación redondeada a pesos.
- Indicadores comerciales sobre ventas cerradas positivas; ceros, negativos,
  eliminadas y pedidos abiertos se identifican por separado.
- Detiene el análisis si hay IDs duplicados/vacíos o fechas/importes inválidos.
- Usa Fecha para mes/día y Creación para horas; no inventa offsets de zona.
- Días sin registros no se presuponen como ceros; promedio diario sobre fechas
  con ventas positivas. Señala meses con cobertura parcial del archivo.
- No reparte importes de pagos mixtos, calcula comisiones ni infiere depósitos.
- No copia clientes, comentarios, camareros ni identificadores de ventas a los resultados.
- No modifica la base de la app ni reemplaza Fudo. Sin costos, recetas y compras,
  no determina utilidad, stock ni popularidad de platos.

Pruebas con archivos temporales ficticios:

```powershell
python -m unittest discover -s tools/analysis -p test_fudo_sales.py
```
