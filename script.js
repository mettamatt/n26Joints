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

    function clearStatus() {
        statusElement.innerHTML = '';
    }

    function appendStatus(message, isError = false, details = '') {
        const statusItem = document.createElement('div');
        statusItem.className = `status-item ${isError ? 'error' : 'success'}`;
        statusItem.textContent = message;
        if (isError) {
            console.error(`Error: ${message} ${details}`);
        }
        statusElement.appendChild(statusItem);
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

            // Enable the drop zone and file input once Pyodide is loaded
            dropZone.classList.remove('disabled');
            dropZone.style.pointerEvents = 'auto';
            fileInput.disabled = false;

            return pyodide;
        } catch (error) {
            appendStatus('Failed to load necessary packages. Please check your internet connection and try again.', true, error.message);
        }
    }

    const pyodide = await loadPyodideAndPackages();
    if (!pyodide) return;

    const script = ``;

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

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            await handleFiles(files);
        }
    });

    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            handleFiles(files);
        }
    });

    async function handleFiles(files) {
       clearStatus();
        for (const file of files) {
            if (file.type === 'application/pdf') {
                updateProgressBar(10);
                try {
                    const arrayBuffer = await file.arrayBuffer();
                    const uint8Array = new Uint8Array(arrayBuffer);

                    updateProgressBar(30);
                    const transactions = await processPdf(uint8Array);

                    if (transactions && transactions.length > 0) {
                        updateProgressBar(70);
                        appendStatus(`CSV file generated successfully for ${file.name} with ${transactions.length} transactions.`, false);
                        updateProgressBar(100);
                        downloadCsv(transactions, `${file.name.replace(/\.pdf$/i, '')}.csv`);
                    } else {
                        appendStatus(`No transactions found in ${file.name}.`, true);
                    }
                } catch (error) {
                    appendStatus(`An error occurred during PDF processing for ${file.name}.`, true, error.message);
                } finally {
                    setTimeout(() => updateProgressBar(0, false), 2000);
                }
            } else {
                appendStatus(`Please select a valid PDF file. Skipping file: ${file.name}`, true);
            }
        }

        appendStatus('All files processed.');
    }

    async function loadPythonCode() {
        try {
            const response = await fetch('n26_pdf_extractor.py');
            if (!response.ok) {
                throw new Error(`Failed to load Python file: ${response.statusText}`);
            }
            return await response.text();
        } catch (error) {
            console.error("Error loading Python code:", error);
            throw error;
        }
    }

    async function processPdf(uint8Array) {
        pyodide.globals.set('pdf_data', uint8Array);

        try {
            const pythonCode = await loadPythonCode();

            const transactions = await pyodide.runPythonAsync(pythonCode);
            return transactions.toJs();  // Convert the Python list to a JS array
        } catch (error) {
            appendStatus('Failed to process the PDF file.', true, error.message);
            throw error;  // Re-throw the error so it can be caught in the calling function
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
