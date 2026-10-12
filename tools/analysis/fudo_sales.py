"""Analyze a Fudo sales export locally, without uploading customer data.

python tools/analysis/fudo_sales.py "path/to/Ventas.csv" --output private-reports/ventas
Optional charts: install matplotlib; the report itself uses only the standard library.
"""
from __future__ import annotations

import argparse
import calendar
import csv
import datetime as dt
import hashlib
import html
import json
import re
from collections import Counter, defaultdict
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
from statistics import median

DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
REQUIRED = {"Id", "Fecha", "Creación", "Cerrada", "Estado", "Total", "Tipo de Venta", "Personas"}


def money(value):
    number = Decimal(value.strip() or "0")
    if not number.is_finite():
        raise InvalidOperation("Non-finite amount")
    return number


def timestamp(value):
    try:
        return dt.datetime.strptime(value, "%d/%m/%Y %H:%M:%S")
    except (TypeError, ValueError):
        return None


def average(total, count):
    return total / count if count else Decimal(0)


def pesos(value):
    rounded = Decimal(str(value)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return "$" + f"{rounded:,}".replace(",", ".")


def percent(a, b):
    return round(100 * a / b, 1) if b else None


def growth(a, b):
    return round(float((a / b - 1) * 100), 1) if b else None


def aggregate(rows, key):
    groups = defaultdict(list)
    for row in rows:
        groups[key(row)].append(row)
    return [dict(group=k, sales=len(v), total=sum((r["amount"] for r in v), Decimal(0)),
                 ticket=average(sum((r["amount"] for r in v), Decimal(0)), len(v)),
                 days=len({r["day"] for r in v})) for k, v in sorted(groups.items())]


def analyze(path: Path):
    with path.open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        columns = reader.fieldnames or []
        if REQUIRED - set(columns):
            raise ValueError("Faltan columnas: " + ", ".join(sorted(REQUIRED - set(columns))))
        raw = list(reader)
    if not raw:
        raise ValueError("La exportación no contiene ventas.")
    ids = [r["Id"] for r in raw]
    if any(not x.strip() for x in ids) or len(set(ids)) != len(ids):
        raise ValueError("Hay IDs vacíos o duplicados. Revisar antes de sumar ventas.")
    rows = []
    for line, row in enumerate(raw, 2):
        try:
            amount = money(row["Total"])
            day = dt.date.fromisoformat(row["Fecha"])
        except (InvalidOperation, ValueError, TypeError):
            raise ValueError(f"Monto o fecha inválidos en registro {line}; no se generó un total parcial.") from None
        rows.append({"amount": amount, "day": day, "created": timestamp(row["Creación"]),
                     "closed": timestamp(row["Cerrada"]), "status": row["Estado"],
                     "type": row["Tipo de Venta"], "people": row["Personas"],
                     "payment": row.get("Medio de Pago", "").strip() or "Sin dato",
                     "room": row.get("Sala", "").strip() or "Sin dato",
                     "has_client": bool(row.get("Cliente", "").strip()),
                     "fiscal": row.get("Fiscal", "").strip() or "Sin dato"})
    first, last = min(r["day"] for r in rows), max(r["day"] for r in rows)
    closed = [r for r in rows if r["status"] == "Cerrada"]
    positive = [r for r in closed if r["amount"] > 0]
    local = [r for r in positive if r["type"] == "Local"]
    total = sum((r["amount"] for r in positive), Decimal(0))
    recent_first = last - dt.timedelta(days=83)
    recent = [r for r in positive if r["day"] >= recent_first]
    durations, anomalous = [], 0
    for r in local:
        if r["created"] and r["closed"] and r["closed"] >= r["created"]:
            durations.append((r["closed"] - r["created"]).total_seconds() / 60)
        else:
            anomalous += 1
    monthly = aggregate(positive, lambda r: r["day"].strftime("%Y-%m"))
    for m in monthly:
        year, month = map(int, m["group"].split("-"))
        start, end = dt.date(year, month, 1), dt.date(year, month, calendar.monthrange(year, month)[1])
        m["partial"] = first > start or last < end
        m["calendar_days"] = (min(end, last) - max(start, first)).days + 1
        m["per_recorded_day"] = average(m["total"], m["days"])
    people = Counter(r["people"] or "Sin dato" for r in local)
    small = sum(v for k, v in people.items() if k in {"1", "2", "3", "4"})
    peak = sum(1 for r in local if r["created"] and 13 <= r["created"].hour < 16)
    by_month = {m["group"]: m for m in monthly}
    comparisons = []
    complete_month = last.month if last.day == calendar.monthrange(last.year, last.month)[1] else last.month - 1
    candidate = dt.date(last.year, complete_month, 1) if complete_month else dt.date(last.year-1, 12, 1)
    comparable = []
    for _ in range(3):
        comparable.append((candidate.strftime('%Y-%m'), f'{candidate.year-1}-{candidate.month:02}'))
        candidate = (candidate - dt.timedelta(days=1)).replace(day=1)
    for current, previous in comparable:
        if current in by_month and previous in by_month:
            a, b = by_month[current], by_month[previous]
            comparisons.append({"current": current, "previous": previous,
                                "total_growth": growth(a["total"], b["total"]),
                                "sales_growth": growth(Decimal(a["sales"]), Decimal(b["sales"])),
                                "ticket_growth": growth(a["ticket"], b["ticket"]),
                                "partial": a["partial"] or b["partial"]})
    ytd = {}
    for year in (last.year-1, last.year):
        values = [r for r in positive if r["day"].year == year and r["day"].month <= complete_month]
        subtotal = sum((r["amount"] for r in values), Decimal(0))
        ytd[str(year)] = {"total": subtotal, "sales": len(values), "ticket": average(subtotal, len(values))}
    report = {
        "source_sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "columns": columns,
        "first_date": first.isoformat(), "last_date": last.isoformat(), "records": len(rows),
        "unique_ids": len(set(ids)), "statuses": dict(Counter(r["status"] for r in rows)),
        "closed_sales": len(closed), "positive_sales": len(positive), "positive_total": total,
        "closed_total": sum((r["amount"] for r in closed), Decimal(0)),
        "zero_closed": sum(r["amount"] == 0 for r in closed),
        "negative_closed": sum(r["amount"] < 0 for r in closed), "average_ticket": average(total, len(positive)),
        "median_ticket": median([r["amount"] for r in positive]) if positive else Decimal(0),
        "client_named": sum(r["has_client"] for r in closed), "fiscal": dict(Counter(r["fiscal"] for r in rows)),
        "missing_payment_positive": sum(r["payment"] == "Sin dato" for r in positive),
        "missing_creation_positive": sum(r["created"] is None for r in positive),
        "creation_day_differs": sum(r["created"] is not None and r["created"].date() != r["day"] for r in positive),
        "monthly": monthly, "daily": aggregate(positive, lambda r: r["day"].isoformat()),
        "weekdays": aggregate(positive, lambda r: r["day"].weekday()),
        "local_hours": aggregate([r for r in local if r["created"]], lambda r: r["created"].hour),
        "channels": aggregate(positive, lambda r: r["type"]),
        "payments": aggregate(positive, lambda r: r["payment"]),
        "rooms": aggregate(local, lambda r: r["room"]),
        "local_positive": len(local), "local_small_percent": percent(small, len(local)),
        "local_peak_percent": percent(peak, len(local)), "local_people": dict(people),
        "duration_count": len(durations), "duration_anomalies": anomalous,
        "duration_median": round(median(durations), 1) if durations else None,
        "duration_p90": round(sorted(durations)[int((len(durations)-1)*.9)], 1) if durations else None,
        "recent_first": recent_first.isoformat(), "recent_last": last.isoformat(),
        "recent_sales": len(recent), "recent_total": sum((r["amount"] for r in recent), Decimal(0)),
        "recent_weekdays": aggregate(recent, lambda r: r["day"].weekday()),
        "comparisons": comparisons, "matched_years": ytd, "complete_month": complete_month,
        "comparison_year": last.year,
        "matched_coverage": complete_month > 0 and first <= dt.date(last.year-1, 1, 1),
    }
    assert sum((m["total"] for m in monthly), Decimal(0)) == total
    assert sum((c["total"] for c in report["channels"]), Decimal(0)) == total
    assert sum((p["total"] for p in report["payments"]), Decimal(0)) == total
    return report


def write_csv(path, rows):
    if not rows:
        return
    with path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def table(headers, rows):
    return "| " + " | ".join(headers) + " |\n| " + " | ".join("---" for _ in headers) + " |\n" + "\n".join("| " + " | ".join(map(str, row)) + " |" for row in rows)


def markdown(r):
    recent = sorted(r["recent_weekdays"], key=lambda x: average(x["total"], x["days"]), reverse=True)
    strongest = recent[0] if recent else None
    year, month = r['comparison_year'], r['complete_month']
    ytd = r['matched_years']
    if r['matched_coverage']:
        comparison_text = f"Enero a {MONTH_NAMES[month-1]} de {year}: {pesos(ytd[str(year)]['total'])}, frente a {pesos(ytd[str(year-1)]['total'])} del mismo intervalo de {year-1}: **{growth(ytd[str(year)]['total'], ytd[str(year-1)]['total'])}%** de variación en importe. No se ajusta por cambios de precios o inflación."
    else:
        comparison_text = "El archivo no ofrece cobertura suficiente para comparar acumulados de años completos hasta el último mes terminado."
    return f"""# Costa Mar — análisis privado de ventas Fudo

**Período real del archivo:** {r['first_date']} a {r['last_date']}. El archivo no contiene ventas anteriores a la primera fecha registrada. Meses de cobertura parcial: {', '.join(m['group'] for m in r['monthly'] if m['partial']) or 'ninguno en los límites del rango'}. El rango elegido en Fudo no demuestra que exista todo el histórico.

## Hallazgos

- {r['records']:,} registros únicos: {r['closed_sales']:,} cerrados, de los cuales {r['positive_sales']:,} tienen importe positivo y {r['zero_closed']} tienen total cero. Estados: {json.dumps(r['statuses'], ensure_ascii=False)}.
- Total de ventas cerradas positivas: **{pesos(r['positive_total'])}**. Ticket promedio por venta: **{pesos(r['average_ticket'])}**; mediana: **{pesos(r['median_ticket'])}**. Son ventas registradas, no utilidad ni dinero disponible en banco.
- En local, **{r['local_small_percent']}%** de las {r['local_positive']:,} ventas positivas tiene 1–4 personas registradas. **{r['local_peak_percent']}%** se abrió entre las 13:00 y antes de las 16:00.
- {comparison_text}
- Últimos 84 días ({r['recent_first']} a {r['recent_last']}): {pesos(r['recent_total'])}, {r['recent_sales']:,} ventas. El día con mayor promedio por fecha con ventas registradas es **{DAY_NAMES[strongest['group']] if strongest else 'sin datos'}**. Revisar la tabla para no confundir frecuencia de días con rendimiento.

## Ventas por mes

{table(['Mes', 'Ventas positivas', 'Importe', 'Ticket promedio', 'Días con ventas positivas', 'Cobertura'], [[m['group'], m['sales'], pesos(m['total']), pesos(m['ticket']), m['days'], 'Parcial' if m['partial'] else 'Mes dentro del rango'] for m in r['monthly']])}

## Comparación con el mismo mes del año anterior

{table(['Mes actual', 'Importe vs. año anterior', 'Cantidad vs. año anterior', 'Ticket vs. año anterior'], [[c['current'], str(c['total_growth'])+'%', str(c['sales_growth'])+'%', str(c['ticket_growth'])+'%'] for c in r['comparisons']])}

Una mayor cantidad con menor ticket no permite atribuir una causa: pueden influir precios, composición de pedidos, descuentos o cambios de registro. El CSV no separa esos efectos. Una comparación marcada parcial no equivale a meses completos.

## Días de la semana — últimos 84 días

{table(['Día', 'Fechas con ventas', 'Ventas', 'Importe', 'Promedio por fecha registrada', 'Ticket'], [[DAY_NAMES[m['group']], m['days'], m['sales'], pesos(m['total']), pesos(average(m['total'], m['days'])), pesos(m['ticket'])] for m in r['recent_weekdays']])}

## Horas de apertura de pedidos — local, todo el archivo

{table(['Hora', 'Ventas locales', 'Importe local', 'Ticket'], [[str(m['group']).zfill(2)+':00–'+str(m['group']+1).zfill(2)+':00', m['sales'], pesos(m['total']), pesos(m['ticket'])] for m in r['local_hours']])}

## Canales de venta

{table(['Canal', 'Ventas', 'Importe', '% del importe', 'Ticket'], [[m['group'], m['sales'], pesos(m['total']), str(percent(m['total'], r['positive_total']))+'%', pesos(m['ticket'])] for m in r['channels']])}

## Medios de pago registrados

{table(['Medio', 'Ventas', 'Importe de esas ventas'], [[m['group'], m['sales'], pesos(m['total'])] for m in sorted(r['payments'], key=lambda m:m['total'], reverse=True)])}

Un pago mixto se conserva como una categoría completa: no conocemos cuánto correspondió a cada medio. Este importe no permite calcular comisiones ni acreditar depósitos bancarios.

## Calidad de datos y alcance

- IDs duplicados: ninguno. Fechas e importes válidos; sumas mensuales, por canal y por medio de pago coinciden exactamente usando Decimal. Ventas cerradas con importe negativo: {r['negative_closed']}; total cerrado incluyendo ceros/negativos: {pesos(r['closed_total'])}.
- {r['missing_payment_positive']} ventas positivas sin medio de pago; {r['missing_creation_positive']} sin hora de creación interpretable; {r['creation_day_differs']} con fecha de creación distinta de `Fecha`.
- {r['client_named']} ventas cerradas tienen cliente informado ({percent(r['client_named'], r['closed_sales'])}%). Un nombre no equivale a un socio ni permite identificar automáticamente personas repetidas.
- `Fiscal`: {json.dumps(r['fiscal'], ensure_ascii=False)}. El campo no es evidencia suficiente sobre boletas, obligaciones fiscales o cumplimiento; revisar su significado en la exportación antes de usarlo como indicador.
- Tiempo apertura→cierre del pedido local: mediana {r['duration_median']} minutos y percentil 90 {r['duration_p90']} ({r['duration_count']:,} observaciones; {r['duration_anomalies']} anómalas/no interpretables). No mide con exactitud la permanencia del cliente ni disponibilidad de una mesa.
- Se usa `Fecha` para días y meses, y `Creación` para horas. Las horas no traen zona; se interpretan como la hora local registrada por Fudo. No se convierte ni se inventa un offset.
- Se excluyen pedidos eliminados, pagando y en curso de los indicadores de ventas realizadas. Los ceros se muestran aparte del ticket comercial. Los importes se calculan con decimales exactos; la presentación redondea a pesos.
- Un día sin registros no se considera automáticamente día cerrado ni venta cero. Los promedios diarios usan fechas con ventas positivas. “Mes dentro del rango” no certifica integridad de datos.
- No hay líneas de productos, costos, recetas, inventario ni facturas de proveedores en este archivo. No se calcula margen, utilidad, IVA, productos más vendidos ni gasto.

## Prioridades que sugieren estos datos

1. **Operación de reservas y registro correcto:** vigilar el tramo de almuerzo y mantener las mesas de 2–4 personas como base. El histórico apoya revisar ese tramo, pero no modifica cupos, horarios ni duración ya acordados.
2. **Gastos y cuentas por pagar:** preparar el siguiente módulo con fecha, proveedor, categoría, importe, vencimiento, estado de pago y comprobante. Antes de automatizar, definir quién registra y con qué documentos. Eso permite empezar a ver egresos; aún no basta para utilidad contable.
3. **Ventas por importación CSV:** una futura vista admin puede reutilizar este análisis, con previsualización y detección de IDs duplicados. El análisis actual es privado y local; no importa ventas en la base de la app.
4. **Inventario después de costos y recetas:** empezar por insumos y platos principales cuando tengamos compras, unidades, mermas y fichas técnicas. El listado de platos actual no representa stock.

Generado localmente, sin nombres de clientes, teléfonos, comentarios ni funcionarios. Mantener el CSV y estos resultados fuera del repositorio público.
"""


def html_report(r, text):
    # No scripts or external assets. Escaped text and aggregate-only charts stay local.
    blocks = []
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith("| "):
            rows = []
            while i < len(lines) and lines[i].startswith("| "):
                cells = [c.strip() for c in lines[i].strip("|").split("|")]
                if not all(c == "---" for c in cells):
                    tag = "th" if not rows else "td"
                    rows.append("<tr>" + "".join(f"<{tag}>{html.escape(c)}</{tag}>" for c in cells) + "</tr>")
                i += 1
            blocks.append('<div class="scroll"><table><thead>' + rows[0] + '</thead><tbody>' + "".join(rows[1:]) + "</tbody></table></div>")
            continue
        if line.startswith("# "):
            blocks.append("<h1>" + html.escape(line[2:]) + "</h1>")
        elif line.startswith("## "):
            blocks.append("<h2>" + html.escape(line[3:]) + "</h2>")
        elif line:
            parts = [line]
            while i + 1 < len(lines) and lines[i+1] and not lines[i+1].startswith(("#", "| ", "- ")) and not re.match(r"\d+\. ", lines[i+1]):
                i += 1
                parts.append(lines[i].strip())
            escaped = re.sub(r"\*\*(.*?)\*\*", r"<strong>\1</strong>", html.escape(" ".join(parts)))
            escaped = re.sub(r"`([^`]+)`", r"<code>\1</code>", escaped)
            escaped = re.sub(r"\[([^\]]+)\]\((https?://[^\s)]+)\)", r'<a href="\2">\1</a>', escaped)
            blocks.append("<p>" + escaped + "</p>")
        i += 1
    chart = '<img src="ventas-resumen.svg" alt="Ventas por mes, promedio por día de semana y pedidos locales por hora"/>' if r.get("chart") else ""
    result = '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Costa Mar · Ventas Fudo</title><style>body{font:16px/1.6 system-ui;background:#f4fafc;color:#153c50;margin:0}main{max-width:1100px;margin:auto;padding:28px}h1,h2{color:#087c91}h2{margin-top:36px}.scroll{overflow:auto}table{border-collapse:collapse;background:white;width:100%;font-size:14px}td,th{padding:10px;text-align:left;border-bottom:1px solid #d5e6ed;white-space:nowrap}th{background:#153c50;color:white}img{width:100%;background:white}p{overflow-wrap:anywhere}@media print{body{background:white;font-size:11px}main{padding:0}table{font-size:10px;table-layout:fixed}td,th{padding:4px;white-space:normal;overflow-wrap:anywhere}.scroll{overflow:visible}h2{break-after:avoid}tr{break-inside:avoid}img{max-height:170mm;object-fit:contain}}</style><main>' + "".join(blocks[:2]) + chart + "".join(blocks[2:]) + "</main></html>"
    title = html.escape(next((line[2:] for line in lines if line.startswith("# ")), "Costa Mar"))
    return result.replace("<title>Costa Mar · Ventas Fudo</title>", "<title>" + title + "</title>")


def chart(r, output):
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from matplotlib.ticker import FuncFormatter
    except ImportError:
        return False
    fig, axes = plt.subplots(3, 1, figsize=(12, 13), layout="constrained")
    fig.suptitle("Costa Mar · Ventas Fudo", fontsize=22, color="#153c50")
    month = r["monthly"]
    axes[0].bar([m["group"] for m in month], [float(m["total"])/1e6 for m in month],
                color=["#c99320" if m["partial"] else "#087c91" for m in month])
    axes[0].set_title("Ventas positivas por mes · dorado = cobertura parcial")
    axes[0].set_ylabel("Millones de pesos")
    axes[0].tick_params(axis="x", rotation=60)
    week = r["recent_weekdays"]
    axes[1].bar([DAY_NAMES[m["group"]] for m in week], [float(average(m["total"], m["days"])) for m in week], color="#1263a0")
    axes[1].set_title(f"Promedio por fecha con ventas positivas · {r['recent_first']} a {r['recent_last']}")
    axes[1].yaxis.set_major_formatter(FuncFormatter(lambda n, _: pesos(n)))
    hours = r["local_hours"]
    axes[2].bar([m["group"] for m in hours], [m["sales"] for m in hours], color="#087c91")
    axes[2].set_title("Pedidos locales positivos por hora de apertura · todo el archivo")
    axes[2].set_xlabel("Hora registrada en Fudo")
    axes[2].set_ylabel("Cantidad de ventas")
    for ax in axes:
        ax.spines[["top", "right"]].set_visible(False)
        ax.grid(axis="y", alpha=.18)
        ax.set_axisbelow(True)
    fig.savefig(output / "ventas-resumen.svg")
    fig.savefig(output / "ventas-resumen.png", dpi=150)
    fig.savefig(output / "ventas-resumen.pdf")
    plt.close(fig)
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", type=Path)
    parser.add_argument("--output", type=Path, default=Path("private-reports/ventas-fudo"))
    args = parser.parse_args()
    report = analyze(args.csv)
    args.output.mkdir(parents=True, exist_ok=True)
    report["chart"] = chart(report, args.output)
    text = markdown(report)
    (args.output / "informe.md").write_text(text, encoding="utf-8")
    (args.output / "informe.html").write_text(html_report(report, text), encoding="utf-8")
    (args.output / "resumen.json").write_text(json.dumps(report, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    for key in ("monthly", "daily", "recent_weekdays", "local_hours", "channels", "payments"):
        write_csv(args.output / (key + ".csv"), report[key])
    print(f"Informe privado: {args.output.resolve() / 'informe.html'}")
    print(f"{report['records']} registros; {report['positive_sales']} ventas positivas; sumas reconciliadas.")


if __name__ == "__main__":
    main()
