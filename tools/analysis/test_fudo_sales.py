import csv
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path

from fudo_sales import analyze, html_report, markdown


class FudoSalesTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "Ventas.csv"
        self.addCleanup(self.temp.cleanup)
        self.rows = [self.row("1", "100.51"), self.row("2", "49.49"),
                     self.row("3", "0"), self.row("4", "999", "Eliminada"),
                     self.row("5", "888", "Pagando")]

    def row(self, identifier, total, status="Cerrada"):
        return {"Id": identifier, "Fecha": "2026-09-05", "Creación": "05/09/2026 13:00:00",
                "Cerrada": "05/09/2026 14:00:00", "Estado": status, "Total": total,
                "Tipo de Venta": "Local", "Personas": "2", "Medio de Pago": "Efectivo-Tarjeta",
                "Cliente": "CLIENTE PRIVADO", "Comentario": "NOTA PRIVADA"}

    def write(self):
        with self.path.open("w", encoding="utf-8-sig", newline="") as stream:
            writer = csv.DictWriter(stream, fieldnames=list(self.rows[0]))
            writer.writeheader()
            writer.writerows(self.rows)

    def test_reconciles_money_without_open_cancelled_or_zero_ticket(self):
        self.write()
        r = analyze(self.path)
        self.assertEqual(r["positive_total"], Decimal("150.00"))
        self.assertEqual(r["average_ticket"], Decimal("75.00"))
        self.assertEqual(r["positive_sales"], 2)
        self.assertEqual(r["closed_sales"], 3)
        self.assertEqual(r["payments"][0]["total"], Decimal("150.00"))
        self.assertEqual(r["payments"][0]["group"], "Efectivo-Tarjeta")
        self.assertTrue(r["monthly"][0]["partial"])

    def test_duplicate_ids_stop_report_before_double_counting(self):
        self.rows[1]["Id"] = "1"
        self.write()
        with self.assertRaisesRegex(ValueError, "duplicados"):
            analyze(self.path)

    def test_invalid_or_non_finite_amounts_do_not_produce_partial_totals(self):
        for value in ("NaN", "Infinity", "1.234,56", "invalid"):
            self.rows[0]["Total"] = value
            self.write()
            with self.assertRaisesRegex(ValueError, "inválidos"):
                analyze(self.path)

    def test_private_fields_are_not_copied_into_aggregate_reports(self):
        self.write()
        r = analyze(self.path)
        text = markdown(r)
        output = html_report(r, text)
        self.assertNotIn("CLIENTE PRIVADO", str(r) + text + output)
        self.assertNotIn("NOTA PRIVADA", str(r) + text + output)
        self.assertEqual(r["client_named"], 3)

    def test_html_escapes_data_and_negative_closed_sales_stay_separate(self):
        self.rows[0]["Medio de Pago"] = "<script>alert(1)</script>"
        self.rows.append(self.row("6", "-10.25"))
        self.write()
        r = analyze(self.path)
        self.assertEqual(r["closed_total"], Decimal("139.75"))
        self.assertEqual(r["positive_total"], Decimal("150.00"))
        self.assertEqual(r["negative_closed"], 1)
        output = html_report(r, markdown(r))
        self.assertNotIn("<script>", output)
        self.assertIn("&lt;script&gt;", output)


if __name__ == "__main__":
    unittest.main()
