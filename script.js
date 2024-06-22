document.addEventListener('DOMContentLoaded', async () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const statusElement = document.getElementById('status');
    const progressBar = document.getElementById('progress-bar');
    const progress = document.querySelector('.progress-bar .progress');

    // Disable the drop zone and file input initially
    dropZone.classList.add('disabled');
    dropZone.style.pointerEvents = 'none';
    fileInput.disabled = true;

    function setStatus(message, isError = false, details = '') {
        statusElement.textContent = message;
        statusElement.className = isError ? 'status error' : 'status success';
        if (isError) {
            console.error(`Error: ${message} ${details}`);
        }
    }

    function updateProgressBar(percentage, show = true) {
        progressBar.style.display = show ? 'block' : 'none';
        progress.style.width = `${percentage}%`;
    }

    async function loadPyodideAndPackages() {
        try {
            const pyodide = await loadPyodide({
                indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.1/full/'
            });
            await pyodide.loadPackage('micropip');
            await pyodide.runPythonAsync(`
                import micropip
                await micropip.install('pypdf')
                
                import warnings
                warnings.filterwarnings("ignore", category=DeprecationWarning)
            `);
            setStatus('Python packages loaded successfully.');
            
            // Enable the drop zone and file input once Pyodide is loaded
            dropZone.classList.remove('disabled');
            dropZone.style.pointerEvents = 'auto';
            fileInput.disabled = false;

            return pyodide;
        } catch (error) {
            setStatus('Failed to load necessary packages. Please check your internet connection and try again.', true, error.message);
        }
    }

    const pyodide = await loadPyodideAndPackages();
    if (!pyodide) return;

    const script = `
import io
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

def main(pdf_data):
    text_by_page = extract_text_from_pdf(pdf_data)
    transactions = parse_transactions(text_by_page)
    return transactions
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
            handleFile(file);
        }
    });

    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleFile(file);
        }
    });

    async function handleFile(file) {
        if (file.type === 'application/pdf') {
            setStatus('Processing PDF file...');
            updateProgressBar(10);

            try {
                const arrayBuffer = await file.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);

                updateProgressBar(30);
                const transactions = await processPdf(uint8Array);

                updateProgressBar(70);
                setStatus(`CSV file generated successfully with ${transactions.length} transactions.`);
                updateProgressBar(100);
                downloadCsv(transactions, 'transactions_ynab.csv');
            } catch (error) {
                setStatus('An error occurred during PDF processing.', true, error.message);
            } finally {
                setTimeout(() => updateProgressBar(0, false), 2000);
            }
        } else {
            setStatus('Please select a PDF file.', true);
        }
    }

    async function processPdf(uint8Array) {
        pyodide.globals.set('pdf_data', uint8Array);

        const pythonCode = `
transactions = main(pdf_data)
transactions
        `;

        try {
            const transactions = await pyodide.runPythonAsync(pythonCode);
            return transactions.toJs();
        } catch (error) {
            setStatus('Failed to process the PDF file.', true, error.message);
        }
    }

    function convertToCsv(transactions) {
        const headers = ["Date", "Payee", "Memo", "Amount"];
        const csvRows = [headers.join(",")];

        transactions.forEach(transaction => {
            const values = headers.map(header => transaction[header]);
            csvRows.push(values.join(","));
        });

        return csvRows.join("\n");
    }

    function downloadCsv(transactions, filename) {
        const csv = convertToCsv(transactions);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
});
