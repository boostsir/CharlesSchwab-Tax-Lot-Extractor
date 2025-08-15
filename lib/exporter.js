function createCSVHeaders() {
    return [
        'Account ID',
        'Symbol',
        'Open Date',
        'Quantity',
        'Price',
        'Cost Per Share',
        'Market Value',
        'Cost Basis',
        'Gain/Loss ($)',
        'Gain/Loss (%)',
        'Holding Period'
    ];
}

function formatLotForCSV(accountId, symbol, lot) {
    return [
        accountId,
        symbol,
        lot.open_date,
        lot.quantity,
        lot.price,
        lot.cost_per_share,
        lot.market_value,
        lot.cost_basis,
        lot.gain_or_loss,
        lot.gain_or_loss_percentage,
        lot.holding_period
    ];
}

function escapeCSVField(field) {
    if (field === null || field === undefined) {
        return '';
    }
    
    const stringField = String(field);
    
    // If field contains comma, quote, or newline, wrap in quotes and escape quotes
    if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
        return '"' + stringField.replace(/"/g, '""') + '"';
    }
    
    return stringField;
}

function convertToCSV(taxLotData) {
    const headers = createCSVHeaders();
    const rows = [headers.map(escapeCSVField).join(',')];

    Object.entries(taxLotData).forEach(([accountId, symbolArray]) => {
        symbolArray.forEach(symbolObj => {
            Object.entries(symbolObj).forEach(([symbol, lots]) => {
                lots.forEach(lot => {
                    const row = formatLotForCSV(accountId, symbol, lot);
                    rows.push(row.map(escapeCSVField).join(','));
                });
            });
        });
    });

    return rows.join('\n');
}

function formatJSONExport(taxLotData) {
    return JSON.stringify(taxLotData, null, 2);
}

function downloadFile(data, format) {
    let content, filename, mimeType;

    if (format === 'json') {
        content = formatJSONExport(data);
        filename = 'schwab-tax-lots.json';
        mimeType = 'application/json';
    } else if (format === 'csv') {
        content = convertToCSV(data);
        filename = 'schwab-tax-lots.csv';
        mimeType = 'text/csv';
    } else {
        throw new Error(`Unsupported export format: ${format}`);
    }

    // Create blob and download
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Export functions for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        convertToCSV,
        formatJSONExport,
        downloadFile,
        createCSVHeaders,
        formatLotForCSV,
        escapeCSVField
    };
}