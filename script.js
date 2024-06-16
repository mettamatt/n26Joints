document.addEventListener('DOMContentLoaded', async () => {
    const dropZone = document.getElementById('drop-zone');
    const statusElement = document.getElementById('status');
    const progressBar = document.getElementById('progress-bar');
    const progress = document.querySelector('.progress-bar .progress');

    function setStatus(message, isError = false) {
        statusElement.textContent = message;
        statusElement.className = isError ? 'status error' : 'status success';
    }

    function updateProgressBar(percentage) {
        progressBar.style.display = 'block';
        progress.style.width = `${percentage}%`;
    }

    function hideProgressBar() {
        progressBar.style.display = 'none';
        progress.style.width = '0';
    }

    function handleError(error) {
        let errorMessage = 'An error occurred.';
        if (error.message.includes('extract text')) {
            errorMessage = 'Failed to extract text from the PDF. Please ensure the file is not corrupted.';
        } else if (error.message.includes('unsupported format')) {
            errorMessage = 'Unsupported PDF format. Please upload a valid bank statement PDF.';
        } else if (error.message.includes('load packages')) {
            errorMessage = 'Failed to load necessary packages. Please check your internet connection and try again.';
        } else if (error.message.includes('install package')) {
            errorMessage = 'Failed to install required Python packages.';
        }
        setStatus(errorMessage, true);
        console.error(error);
        hideProgressBar();
    }

    let pyodide = await loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.20.0/full/'
    });

    // Load necessary Python packages
    try {
        await pyodide.loadPackage(['pandas', 'micropip']);
        await pyodide.runPythonAsync(`
            import micropip
            await micropip.install('pypdf')
        `);
        setStatus('Python packages loaded successfully.');
    } catch (error) {
        handleError(error);
        return;
    }

    // Inline the external Python script
    const script = `
import io
import pandas as pd
import re
from pypdf import PdfReader

def extract_text_from_pdf(pdf_data):
    with io.BytesIO(pdf_data.to_py()) as file:
        reader = PdfReader(file)
        text_by_page = []
        for page in reader.pages:
            text = page.extract_text()
            text_by_page.append(text)
    return text_by_page

def parse_transactions(text_by_page):
    transactions = []
    for page_num, page_text in enumerate(text_by_page):
        start_index = page_text.find("Descripción Fecha de reserva Cantidad")
        if (start_index == -1):
            continue
        page_text = page_text[start_index + len("Descripción Fecha de reserva Cantidad"):].strip()
        transaction_regex = re.compile(
            r'(?P<payee>.+?)\\n(?P<memo>(?:.+\\n)+?)Fecha de valor (?P<fecha_reserva>\\d{2}\\.\\d{2}\\.\\d{4})\\s*(?P<fecha_valor>\\d{2}\\.\\d{2}\\.\\d{4})\\s*(?P<amount>-?\\d{1,3}(?:\\.\\d{3})*,\\d{2}€)',
            re.MULTILINE
        )
        matches = transaction_regex.findall(page_text)
        for match in matches:
            payee, memo, fecha_reserva, fecha_valor, amount = match
            memo = memo.strip().replace("\\n", " ")
            amount = amount.replace('.', '').replace(',', '.').replace('€', '')
            transactions.append({
                'Date': fecha_valor,
                'Payee': payee.strip(),
                'Memo': memo,
                'Amount': amount
            })
    return transactions

def convert_to_ynab_format(transactions):
    for transaction in transactions:
        transaction['Date'] = '/'.join(transaction['Date'].split('.')[::-1])
    return transactions

def main(pdf_data):
    text_by_page = extract_text_from_pdf(pdf_data)
    transactions = parse_transactions(text_by_page)
    ynab_data = convert_to_ynab_format(transactions)
    df = pd.DataFrame(ynab_data)
    return len(transactions), df.to_csv(index=False)
    `;

    await pyodide.runPythonAsync(script);

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.type === 'application/pdf') {
                setStatus('Processing PDF file...');
                updateProgressBar(10); // Start progress

                try {
                    const arrayBuffer = await file.arrayBuffer();
                    const uint8Array = new Uint8Array(arrayBuffer);

                    // Update progress during processing steps
                    updateProgressBar(30); // During file read
                    const [transactionCount, csvData] = await processPdf(uint8Array);
                    updateProgressBar(70); // During PDF processing

                    setStatus(`CSV file generated successfully with ${transactionCount} transactions.`);
                    updateProgressBar(100); // Completion
                } catch (error) {
                    handleError(error);
                } finally {
                    setTimeout(hideProgressBar, 2000); // Hide progress bar after a short delay
                }
            } else {
                setStatus('Please drop a PDF file.', true);
            }
        }
    });

    async function processPdf(uint8Array) {
        pyodide.globals.set('pdf_data', uint8Array);

        const pythonCode = `
transaction_count, csv_data = main(pdf_data)
transaction_count, csv_data
        `;

        let [transactionCount, csvData] = await pyodide.runPythonAsync(pythonCode);
        downloadCsv(csvData, 'transactions_ynab.csv');
        return [transactionCount, csvData];
    }

    function downloadCsv(csv, filename) {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
});
