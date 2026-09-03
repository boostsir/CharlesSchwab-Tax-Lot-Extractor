// Import utility functions when in Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    const { log, delay, parseValue, parseDate, extractSymbolFromTitle } = require('./utils');
    global.log = log;
    global.delay = delay;
    global.parseValue = parseValue;
    global.parseDate = parseDate;
    global.extractSymbolFromTitle = extractSymbolFromTitle;
}

let lastLotsFingerprint = null;

function resetLotFingerprint() {
    lastLotsFingerprint = null;
}

function fingerprintLots(lots) {
    if (!lots || lots.length === 0) {
        return '';
    }
    const first = lots[0];
    const last = lots[lots.length - 1];
    return [lots.length, first.open_date, first.quantity, first.price, last.open_date, last.quantity, last.price].join('|');
}

function getModalLotSymbol() {
    const titleEl = document.getElementById('open-lot-overlay-modal-title') || document.getElementById('hdOverlayTitle');
    if (!titleEl) {
        return null;
    }
    return extractSymbolFromTitle(titleEl.value || titleEl.textContent || '');
}

function findNextStepButtons() {
    const selectors = [
        'button[id^="menu-trigger-next-steps-"]',
        'sdps-button[sdps-name="Next Steps"]',
    ];

    for (const selector of selectors) {
        const buttons = Array.from(document.querySelectorAll(selector)).filter((button) => {
            const rect = button.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        });
        if (buttons.length > 0) {
            return buttons;
        }
    }

    return [];
}

function clickShowAllAccountsLink() {
    const showAll = Array.from(document.querySelectorAll('a, button, span')).find((el) =>
        (el.textContent || '').trim().match(/show all brokerage accounts/i)
    );

    if (!showAll) {
        return false;
    }

    (showAll.closest('a, button') || showAll).click();
    return true;
}

async function collectAllPositionButtons(options = {}) {
    const delayFn = options.delayFn || delay;
    const scrollSteps = options.scrollSteps ?? 10;
    const seen = new Set();
    const collected = [];

    lastLotsFingerprint = null;

    const addButtons = (buttons) => {
        for (const button of buttons) {
            const key = button.id || button;
            if (!seen.has(key)) {
                seen.add(key);
                collected.push(button);
            }
        }
    };

    if (clickShowAllAccountsLink()) {
        await delayFn(options.showAllDelayMs ?? 1500);
    }

    for (let step = 0; step <= scrollSteps; step++) {
        addButtons(findNextStepButtons());
        window.scrollTo(0, Math.round((document.body.scrollHeight * step) / scrollSteps));
        await delayFn(options.scrollDelayMs ?? 500);
        addButtons(findNextStepButtons());
    }

    window.scrollTo(0, 0);
    await delayFn(options.resetDelayMs ?? 400);
    return collected;
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

function triggerLotDetailsClick() {
    const targetSpan = Array.from(document.querySelectorAll('.sdps-menu__item-text, span')).find((span) => {
        if ((span.textContent || '').trim() !== 'Lot Details') {
            return false;
        }
        const rect = span.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    });

    if (!targetSpan) {
        return false;
    }

    (targetSpan.closest('[role="menuitem"], .sdps-menu__item, button') || targetSpan).click();
    return true;
}

function closeLotDetailsModal() {
    const overlay = document.getElementById('open-lot-overlay');
    const closeButton = overlay?.querySelector('.sdps-modal__close, button[aria-label="Close"]');
    if (!closeButton) {
        return false;
    }
    closeButton.click();
    return true;
}

async function waitForMatchingLotTable(expectedSymbol, previousFingerprint, options = {}) {
    const delayFn = options.delayFn || delay;
    const timeoutMs = options.timeoutMs ?? 20000;
    const intervalMs = options.intervalMs ?? 250;
    const started = Date.now();

    while (Date.now() - started < timeoutMs) {
        const modalSymbol = getModalLotSymbol();
        const lots = extractLotDetailsFromTable();
        const fingerprint = fingerprintLots(lots);
        const tableChanged = !previousFingerprint || fingerprint !== previousFingerprint;

        // Schwab reuses one lot modal. Wait until the title has a symbol and
        // the table is no longer the previous scrape. Do not require the
        // positions-row ticker to match — those labels are often fund names.
        if (modalSymbol && lots && lots.length > 0 && tableChanged) {
            return { lots, fingerprint, modalSymbol };
        }

        await delayFn(intervalMs);
    }

    return null;
}

async function processLotDetails(accountId, symbol, options = {}) {
    const result = await waitForMatchingLotTable(
        symbol,
        options.previousFingerprint ?? lastLotsFingerprint,
        options
    );
    if (!result) {
        log(`Lot table for ${symbol} did not update in time`);
        closeLotDetailsModal();
        return false;
    }

    log(`Extracted ${result.lots.length} lots for ${result.modalSymbol} in account ${accountId}`);
    closeLotDetailsModal();
    await delay(options.closeDelayMs ?? 1000);
    return result;
}

async function clickLotDetails(button, processedButtons) {
    const symbol = getSymbolFromRow(button);
    const accountId = getAccountIdFromElement(button);
    const uniqueId = button.id || `${accountId}-${symbol}`;
    
    if (processedButtons.has(uniqueId)) {
        log(`Button for ${symbol} in account ${accountId} already processed, skipping`);
        return { success: false, processed: true };
    }
    
    log(`Clicking Next Steps button for: ${symbol} in account ${accountId}`);
    button.click();
    await delay(600);
    
    log('Clicking Lot Details option');
    if (!triggerLotDetailsClick()) {
        log('Lot Details option not found');
        return { success: false, processed: false };
    }

    const result = await processLotDetails(accountId, symbol);
    if (!result) {
        return { success: false, processed: false, accountId, symbol };
    }

    lastLotsFingerprint = result.fingerprint;
    processedButtons.add(uniqueId);
    
    return {
        success: true,
        processed: true,
        accountId,
        symbol: result.modalSymbol || symbol,
        lots: result.lots
    };
}

// Export functions for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        findNextStepButtons,
        clickShowAllAccountsLink,
        collectAllPositionButtons,
        extractLotDetailsFromTable,
        processLotDetails,
        createTaxLotEntry,
        getAccountIdFromElement,
        getSymbolFromRow,
        getModalLotSymbol,
        fingerprintLots,
        resetLotFingerprint,
        waitForMatchingLotTable,
        closeLotDetailsModal,
        triggerLotDetailsClick,
        clickLotDetails
    };
}
