// Import utility functions when in Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    const { log, delay, parseValue, parseDate, extractSymbolFromTitle } = require('./utils');
    global.log = log;
    global.delay = delay;
    global.parseValue = parseValue;
    global.parseDate = parseDate;
    global.extractSymbolFromTitle = extractSymbolFromTitle;
}

function findNextStepButtons() {
    const buttons = document.querySelectorAll('sdps-button[sdps-name="Next Steps"]');
    return Array.from(buttons).filter(button => {
        const rect = button.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    });
}

function extractLotDetailsFromTable() {
    const table = document.getElementById('responsiveLotTable');
    if (!table) {
        log('Lot details table not found');
        return null;
    }
    
    const rows = table.querySelectorAll('tbody tr.data-row');
    const lots = [];
    
    rows.forEach(row => {
        const openDateCell = row.querySelector('th span');
        const qtyCell = row.querySelector('td[name="Qty"]');
        const priceCell = row.querySelector('td[name="Price"]');
        const cpsCell = row.querySelector('td[name="CPS"] span');
        const mktValCell = row.querySelector('td[name="MktVal"] span');
        const costBasisCell = row.querySelector('td[name="CostBasis"] span');
        const gainLossCell = row.querySelector('td[name="GainLoss"] span');
        const gainLossPercentCell = row.querySelector('td[name="GainLossPercent"] span');
        const holdPeriodCell = row.querySelector('td[name="HoldPeriod"] span');
        
        if (openDateCell && qtyCell && priceCell) {
            const lot = {
                open_date: parseDate(openDateCell.textContent),
                quantity: parseValue(qtyCell.textContent),
                price: parseValue(priceCell.textContent),
                cost_per_share: parseValue(cpsCell?.textContent),
                market_value: parseValue(mktValCell?.textContent),
                cost_basis: parseValue(costBasisCell?.textContent),
                gain_or_loss: parseValue(gainLossCell?.textContent),
                gain_or_loss_percentage: parseValue(gainLossPercentCell?.textContent),
                holding_period: holdPeriodCell?.textContent?.trim() || ''
            };
            lots.push(lot);
        }
    });
    
    return lots;
}

function getAccountIdFromElement(element) {
    const accountContainer = element.closest('tbody[id*="holdingsAccount_"]');
    return accountContainer ? accountContainer.id : 'holdingsAccount_unknown';
}

function getSymbolFromRow(element) {
    const row = element.closest('tr[data-symbol]');
    return row ? row.getAttribute('data-symbol') : 'unknown';
}

function createTaxLotEntry(taxLotData, accountId, symbol, lots) {
    if (!taxLotData[accountId]) {
        taxLotData[accountId] = [];
    }
    
    let symbolObj = taxLotData[accountId].find(item => item[symbol]);
    if (!symbolObj) {
        symbolObj = {};
        symbolObj[symbol] = [];
        taxLotData[accountId].push(symbolObj);
    }
    
    symbolObj[symbol] = symbolObj[symbol].concat(lots);
}

async function processLotDetails(accountId, symbol) {
    await delay(2000);
    
    const overlay = document.getElementById('open-lot-overlay');
    if (!overlay || !overlay.classList.contains('sdps-modal--open')) {
        log('Overlay not found or not open');
        return false;
    }
    
    const titleElement = document.getElementById('open-lot-overlay-modal-title');
    if (!titleElement) {
        log('Title element not found');
        return false;
    }
    
    const extractedSymbol = extractSymbolFromTitle(titleElement.textContent);
    if (!extractedSymbol) {
        log('Could not extract symbol from title');
        return false;
    }
    
    if (extractedSymbol !== symbol) {
        log(`Symbol mismatch: expected ${symbol}, got ${extractedSymbol}`);
    }
    
    const lots = extractLotDetailsFromTable();
    if (!lots || lots.length === 0) {
        log('No lot details found');
        return false;
    }
    
    log(`Extracted ${lots.length} lots for ${symbol} in account ${accountId}`);
    
    const closeButton = overlay.querySelector('.sdps-modal__close');
    if (closeButton) {
        closeButton.click();
        await delay(1000);
    }
    
    return { lots, extractedSymbol };
}

async function clickLotDetails(button, processedButtons) {
    const symbol = getSymbolFromRow(button);
    const accountId = getAccountIdFromElement(button);
    const uniqueId = `${accountId}-${symbol}`;
    
    if (processedButtons.has(uniqueId)) {
        log(`Button for ${symbol} in account ${accountId} already processed, skipping`);
        return { success: false, processed: true };
    }
    
    log(`Clicking Next Steps button for: ${symbol} in account ${accountId}`);
    button.click();
    await delay(1500);
    
    const dropdown = document.getElementById('nextStepsList');
    if (!dropdown || !dropdown.classList.contains('show')) {
        log('Dropdown not found or not open');
        return { success: false, processed: false };
    }
    
    const lotDetailsButton = Array.from(dropdown.querySelectorAll('span')).find(span => 
        span.textContent.trim() === 'Lot Details'
    );
    
    if (!lotDetailsButton) {
        log('Lot Details option not found');
        button.click();
        await delay(500);
        return { success: false, processed: false };
    }
    
    log('Clicking Lot Details option');
    lotDetailsButton.closest('button').click();
    
    const result = await processLotDetails(accountId, symbol);
    processedButtons.add(uniqueId);
    
    return {
        success: !!result,
        processed: true,
        accountId,
        symbol,
        lots: result ? result.lots : null
    };
}

// Export functions for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        findNextStepButtons,
        extractLotDetailsFromTable,
        processLotDetails,
        createTaxLotEntry,
        getAccountIdFromElement,
        getSymbolFromRow,
        clickLotDetails
    };
}