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
    const selectors = [
        'button[id^="menu-trigger-next-steps-"]',
        'sdps-button[sdps-id^="menu-trigger-next-steps-"] button',
        'app-next-steps-column button',
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

    return Array.from(
        document.querySelectorAll('tr[app-position-row] button, .position-row button, button')
    ).filter((button) => {
        const rect = button.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            return false;
        }

        const ariaLabel = button.getAttribute('aria-label') || '';
        const id = button.id || '';
        const html = button.innerHTML || '';
        return (
            ariaLabel.includes('Open Menu') ||
            id.includes('next-steps') ||
            id.includes('menu') ||
            html.includes('icon-sch-menu-flyout')
        );
    });
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

    const addButtons = (buttons) => {
        for (const button of buttons) {
            const key = `${getAccountIdFromElement(button)}-${getSymbolFromRow(button)}`;
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
        const y = Math.round((document.body.scrollHeight * step) / scrollSteps);
        window.scrollTo(0, y);
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
        const openDateCell = row.querySelector('th span') || row.querySelector('th');
        const qtyCell = row.querySelector('td[name="Qty"]');
        const priceCell = row.querySelector('td[name="Price"]');
        const cpsCell = row.querySelector('td[name="CPS"] span') || row.querySelector('td[name="CPS"]');
        const mktValCell = row.querySelector('td[name="MktVal"] span') || row.querySelector('td[name="MktVal"]');
        const costBasisCell = row.querySelector('td[name="CostBasis"] span') || row.querySelector('td[name="CostBasis"]');
        const gainLossCell = row.querySelector('td[name="GainLoss"] span') || row.querySelector('td[name="GainLoss"]');
        const gainLossPercentCell = row.querySelector('td[name="GainLossPercent"] span') || row.querySelector('td[name="GainLossPercent"]');
        const holdPeriodCell = row.querySelector('td[name="HoldPeriod"] span') || row.querySelector('td[name="HoldPeriod"]');
        
        if (openDateCell && qtyCell && priceCell) {
            const openDate = openDateCell.textContent.trim();
            if (openDate.toLowerCase().includes('total')) {
                return;
            }

            lots.push({
                open_date: parseDate(openDateCell.textContent),
                quantity: parseValue(qtyCell.textContent),
                price: parseValue(priceCell.textContent),
                cost_per_share: parseValue(cpsCell?.textContent),
                market_value: parseValue(mktValCell?.textContent),
                cost_basis: parseValue(costBasisCell?.textContent),
                gain_or_loss: parseValue(gainLossCell?.textContent),
                gain_or_loss_percentage: parseValue(gainLossPercentCell?.textContent),
                holding_period: holdPeriodCell?.textContent?.trim() || ''
            });
        }
    });
    
    return lots;
}

function getAccountIdFromElement(element) {
    const accountContainer = element.closest('tbody[id*="holdingsAccount_"]');
    return accountContainer ? accountContainer.id : 'holdingsAccount_unknown';
}

function getSymbolFromRow(element) {
    const row = element.closest('tr[data-symbol]') || element.closest('tr');
    if (!row) {
        return 'unknown';
    }

    if (row.getAttribute('data-symbol')) {
        return row.getAttribute('data-symbol');
    }

    const symbolEl = row.querySelector('[data-symbol], a[href*="symbol="]');
    if (symbolEl) {
        return (symbolEl.getAttribute('data-symbol') || symbolEl.textContent).trim();
    }

    return 'unknown';
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
    const targetSpan = Array.from(document.querySelectorAll('.sdps-menu__item-text, span')).find(
        (span) => span.textContent.trim() === 'Lot Details'
    );

    if (!targetSpan) {
        return false;
    }

    (targetSpan.closest('[role="menuitem"], .sdps-menu__item, button') || targetSpan).click();
    return true;
}

async function processLotDetails(accountId, symbol) {
    await delay(2000);
    
    const lots = extractLotDetailsFromTable();
    if (!lots || lots.length === 0) {
        log('No lot details found');
        return false;
    }
    
    log(`Extracted ${lots.length} lots for ${symbol} in account ${accountId}`);
    
    const overlay = document.getElementById('open-lot-overlay');
    const closeButton = overlay?.querySelector('.sdps-modal__close, button[aria-label="Close"]');
    if (closeButton) {
        closeButton.click();
        await delay(1000);
    }
    
    return { lots, extractedSymbol: symbol };
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
    await delay(600);
    
    log('Clicking Lot Details option');
    if (!triggerLotDetailsClick()) {
        log('Lot Details option not found');
        return { success: false, processed: false };
    }

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
        clickShowAllAccountsLink,
        collectAllPositionButtons,
        extractLotDetailsFromTable,
        processLotDetails,
        createTaxLotEntry,
        getAccountIdFromElement,
        getSymbolFromRow,
        triggerLotDetailsClick,
        clickLotDetails
    };
}
