import io
import re
from pypdf import PdfReader

def extract_text_from_pdf(pdf_data):
    try:
        with io.BytesIO(pdf_data.to_py()) as file:
            reader = PdfReader(file)
            text_by_page = []
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    text_by_page.append(text)
                else:
                    raise ValueError(f"Text extraction failed on page {len(text_by_page) + 1}")
        return text_by_page
    except Exception as e:
        print(f"Error extracting text from PDF: {e}")
        return []

def parse_transactions(text_by_page):
    transactions = []
    for page_num, page_text in enumerate(text_by_page):
        start_index = page_text.find("Descripción Fecha de reserva Cantidad")
        if start_index == -1:
            continue

        page_text = page_text[start_index + len("Descripción Fecha de reserva Cantidad"):].strip()

        transaction_regex = re.compile(
            r"(?P<payee>.+?)\n(?P<memo>(?:.+\n)+?)Fecha de valor (?P<fecha_reserva>\d{2}\.\d{2}\.\d{4})\s*(?P<fecha_valor>\d{2}\.\d{2}\.\d{4})\s*(?P<amount>-?\d{1,3}(?:\.\d{3})*,\d{2}€)",
            re.MULTILINE,
        )

        matches = transaction_regex.findall(page_text)
        for match in matches:
            payee, memo, fecha_reserva, fecha_valor, amount = match
            memo = memo.strip().replace("\n", " ").replace('"', '""')
            amount = amount.replace(".", "").replace(",", ".").replace("€", "")

            try:
                transactions.append({
                    "Date": fecha_valor,
                    "Payee": payee.strip(),
                    "Memo": f'"{memo}"',
                    "Amount": float(amount),
                })
            except ValueError as ve:
                print(f"Failed to process amount '{amount}': {ve}")

    return transactions

def main(pdf_data):
    text_by_page = extract_text_from_pdf(pdf_data)
    if not text_by_page:
        print("No text extracted from the PDF.")
        return []

    transactions = parse_transactions(text_by_page)
    return transactions

# This line is executed when the script is run in Pyodide
transactions = main(pdf_data)
transactions  # Return the transactions to JavaScript