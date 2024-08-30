# PDF to CSV Converter for N26 Joint Accounts in Spain

This tool extracts transactions from your Spanish N26 joint account bank statement PDFs and converts them into YNAB-compatible CSV files. Unlike individual N26 accounts, joint accounts lack a CSV export feature on the N26 website.

## Features

- Extracts transactions from PDF bank statements for N26 joint accounts in Spain.
- Converts the extracted transactions into a CSV format compatible with YNAB (You Need A Budget).
- Supports multiple file uploads for batch processing.
- Secure: All processing is done locally in the browser.

## How to Use

1. Visit https://mettamatt.github.io/n26Joints/
2. Drag and drop one or more N26 joint account bank statement PDFs into the drop zone on the webpage, or click to select files.
3. The tool will process each PDF and automatically download a CSV file for each when the conversion is complete.

## Technical Details

- The project uses [Pyodide](https://pyodide.org/) to run Python code in the browser.
- PDF processing is done using the `pypdf` library.
- A custom Python script (`n26_pdf_extractor.py`) handles the extraction and formatting of transaction data.
- The entire process is handled client-side to ensure data privacy.

## Acknowledgements

- [Pyodide](https://pyodide.org/)
- [pypdf](https://pypi.org/project/pypdf/)