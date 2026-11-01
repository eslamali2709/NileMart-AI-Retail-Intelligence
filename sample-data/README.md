# Synthetic sample data

This directory contains a small, reviewed subset of the project's fictional retail dataset. It represents **Cairo and Alexandria in September 2026**. Names, products, inventory figures, and financial amounts are invented for workflow and RAG demonstrations; they do not describe a real business or real customers.

## Included files

| File | Scope |
| --- | --- |
| [Cairo report](reports/NileMart_CAI_2026-09_Sales_Inventory.pdf) | Two pages: sales and inventory |
| [Alexandria report](reports/NileMart_ALX_2026-09_Sales_Inventory.pdf) | Two pages: sales and inventory |
| [report_index.csv](report_index.csv) | Two report-level reference rows |
| [sales_transactions_summary.csv](sales_transactions_summary.csv) | 24 SKU/report rows |
| [inventory_ledger.csv](inventory_ledger.csv) | 24 stock reconciliation rows |
| [expected_rag_answers.json](expected_rag_answers.json) | Expected values scoped to the two included reports |

PDFs are unchanged copies of the reviewed originals. CSV headers and selected source records were retained verbatim; only records outside the two-report scope were excluded. Expected-answer JSON was derived from those selected records and checked against the PDFs. Private originals remain unchanged.

## Privacy and content review

Both pages of both PDFs were rendered and visually inspected. Extracted text and document metadata were also inspected. Author metadata identifies the synthetic data lab; report footers explicitly label the data synthetic. No private contacts, account URLs, credentials, embedded attachments, or active PDF actions were found in the selected files. CSV and JSON content was checked for credentials, URLs, email addresses, and spreadsheet formula payloads.

This review covers these selected copies, not every file in the private archive. Render previews are local temporary review artifacts, not frontend screenshots.

## Local demonstration

1. Complete the [backend setup](../docs/BACKEND_SETUP.md) using isolated resources.
2. Upload a PDF through the frontend with its matching branch and `2026-09` month. Let Workflow 01 write the metadata log.
3. Verify the Drive file and Sheets row, then confirm Workflow 02 indexing separately.
4. Refresh Sales Reports and open the corresponding PDF.
5. Ask a question such as "What were Cairo's net sales in September 2026?" or "Which products are low stock in these two September reports?"
6. Compare the answer and cited sources against [expected_rag_answers.json](expected_rag_answers.json).

The CSVs are reference data, not a replacement for the six-column production report log. Do not upload `report_index.csv` to the application's PDF form or import it as the metadata log.

## Expected scope and limitations

- Cairo net sales: **EGP 922,573**.
- Alexandria net sales: **EGP 694,294**.
- Combined net sales for these two reports: **EGP 1,616,867**.
- Two low-stock items are identified in the expected-answer file.

These are fixture values, not measured application performance or current live business statistics. The original archive covers four branches and July-September; the public subset does not. Prior-month comparisons printed inside the September PDFs are part of those documents, but full earlier-month PDFs are not included. Do not use this subset to claim complete three-month totals or all-branch rankings.

Stock reconciliation uses opening + received - sold + saleable returns - damaged. Net sales equal gross sales minus discounts and refunds. Low stock means closing stock is at or below the stated reorder point.

Run `node scripts/validate-portfolio.mjs` from the repository root after installing frontend dependencies to check sample arithmetic, PDF scope, and file references without calling any service.
