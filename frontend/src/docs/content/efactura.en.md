# e-Factura

The connection to ANAF's SPV system for electronic invoices.

> **Who has access:** **Administrator** and **Manager** (advanced zone).

## Received and sent invoices
- **Primite** — invoices received from suppliers through SPV.
- **Trimise** — invoices issued by the company, with their status at ANAF.

## Keep in mind
- A successfully sent invoice locks editing of the source document, so it doesn't differ from what was reported.
- Discounts are transmitted as a line-level discount, with positive unit prices, in accordance with e-Factura rules (no negative lines).
- Transmission errors are shown on the invoice, so you know what needs to be corrected.
