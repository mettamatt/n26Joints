# PDF to CSV Converter for N26 Joint Accounts in Spain

This tool extracts transactions from your Spanish N26 joint account bank statement PDF and converts them into a YNAB-compatible CSV file. Unlike individual N26 accounts, joint accounts lack a CSV export feature on the N26 website.

## Features

- Extracts transactions from PDF bank statements for N26 joint accounts in Spain.
- Converts the extracted transactions into a CSV format compatible with YNAB (You Need A Budget).
- Secure: All processing happens locally on your device, ensuring no data is uploaded to the internet.

## How to Use

1. **Open `index.html` in your Browser**

2. **Drag and Drop your Bank Statement PDF**

    Drag and drop your N26 joint account bank statement PDF into the drop zone on the webpage. The tool will process the PDF and automatically download a CSV file when the conversion is complete.

## Technical Details

- The project uses [Pyodide](https://pyodide.org/) to run Python code in the browser.
- The PDF processing is done using the `pypdf` library.
- The extracted transactions are parsed and formatted using the `pandas` library.
- The entire process is handled client-side to ensure data privacy.

## Acknowledgements

- [Pyodide](https://pyodide.org/)
- [pypdf](https://pypi.org/project/pypdf/)
- [pandas](https://pandas.pydata.org/)
