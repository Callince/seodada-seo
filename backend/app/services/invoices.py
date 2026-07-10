"""GST tax-invoice PDF generation (reportlab).

Renders a Payment into an India-compliant tax invoice: seller GSTIN/PAN/CIN,
bill-to buyer, a single digital-service line (SAC 998314), intra-state CGST 9% +
SGST 9%, total, and the amount in words. Money on Payment is in minor units
(paise); divided by 100 for display.
"""
from __future__ import annotations

import io

from num2words import num2words
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.core.config import settings
from app.db.models import InvoiceAddress, Payment


def _rupees(cents: int) -> str:
    return f"Rs. {cents / 100:,.2f}"


def generate_invoice_pdf(payment: Payment, buyer_name: str, buyer: InvoiceAddress | None, plan_name: str) -> bytes:
    base = payment.amount_cents - payment.tax_cents
    cgst = payment.tax_cents // 2
    sgst = payment.tax_cents - cgst

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4, topMargin=18 * mm, bottomMargin=18 * mm, leftMargin=16 * mm, rightMargin=16 * mm
    )
    styles = getSampleStyleSheet()
    small = ParagraphStyle("small", parent=styles["Normal"], fontSize=8.5, leading=12)
    right = ParagraphStyle("right", parent=small, alignment=2)
    h = ParagraphStyle("h", parent=styles["Title"], fontSize=15)
    story = []

    story.append(Paragraph("TAX INVOICE", h))
    story.append(Spacer(1, 6))

    seller = (
        f"<b>{settings.seller_name}</b><br/>{settings.seller_address}<br/>"
        f"GSTIN: {settings.seller_gstin} &nbsp; State: {settings.seller_state} ({settings.seller_state_code})<br/>"
        f"PAN: {settings.seller_pan} &nbsp; CIN: {settings.seller_cin}"
    )
    meta = (
        f"<b>Invoice No:</b> {payment.invoice_number or payment.id[:8]}<br/>"
        f"<b>Date:</b> {payment.created_at:%d %b %Y}<br/>"
        f"<b>Status:</b> {payment.status.title()}"
    )
    story.append(Table([[Paragraph(seller, small), Paragraph(meta, right)]], colWidths=[110 * mm, 68 * mm]))
    story.append(Spacer(1, 8))

    bill = f"<b>Bill To:</b><br/>{buyer_name}"
    if buyer:
        if buyer.company:
            bill += f"<br/>{buyer.company}"
        if buyer.address:
            bill += f"<br/>{buyer.address}"
        loc = ", ".join(x for x in [buyer.city, buyer.state, buyer.pincode] if x)
        if loc:
            bill += f"<br/>{loc}"
        if buyer.gstin:
            bill += f"<br/>GSTIN: {buyer.gstin}"
    story.append(Paragraph(bill, small))
    story.append(Spacer(1, 10))

    rows = [
        ["#", "Description", "SAC", "Qty", "Rate", "Amount"],
        ["1", f"Subscription - {plan_name}", settings.seller_hsn, "1", _rupees(base), _rupees(base)],
        ["", "", "", "", "Taxable value", _rupees(base)],
        ["", "", "", "", "CGST @ 9%", _rupees(cgst)],
        ["", "", "", "", "SGST @ 9%", _rupees(sgst)],
        ["", "", "", "", "Total", _rupees(payment.amount_cents)],
    ]
    table = Table(rows, colWidths=[10 * mm, 82 * mm, 20 * mm, 14 * mm, 26 * mm, 26 * mm])
    table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#273879")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
            ("GRID", (0, 0), (-1, 1), 0.4, colors.HexColor("#c8d0e0")),
            ("LINEABOVE", (4, 2), (-1, 2), 0.4, colors.HexColor("#c8d0e0")),
            ("LINEBELOW", (4, -1), (-1, -1), 0.8, colors.HexColor("#273879")),
            ("FONTNAME", (4, -1), (-1, -1), "Helvetica-Bold"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ])
    )
    story.append(table)
    story.append(Spacer(1, 8))

    words = num2words(payment.amount_cents / 100, lang="en_IN").title()
    story.append(Paragraph(f"<b>Amount in words:</b> Rupees {words} Only", small))
    story.append(Spacer(1, 20))
    story.append(Paragraph(f"For {settings.seller_name}", right))
    story.append(Spacer(1, 16))
    story.append(Paragraph("Authorised Signatory", right))

    doc.build(story)
    return buf.getvalue()
