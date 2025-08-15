javascript:(function() {
    'use strict';
    
    const taxLotData = {};
    let processedButtons = new Set();
    let currentIndex = 0;
    let nextStepButtons = [];
    
    function log(message) {
        console.log('[Tax Lot Extractor]', message);
    }
    
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    function parseValue(text) {
        if (!text) return 0;
        const cleanText = text.replace(/[$,\s+%]/g, '');
        return parseFloat(cleanText) || 0;
    }
    
    function parseDate(dateStr) {
        if (!dateStr) return '';
        return dateStr.trim();
    }
    
    function extractSymbolFromTitle(titleText) {
        const match = titleText.match(/Lot Details:\s*([A-Z\/]+)\s*-/);
        return match ? match[1] : null;
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
        
        log(`Extracted ${lots.length} lots for ${symbol} in account ${accountId}`);
        
        const closeButton = overlay.querySelector('.sdps-modal__close');
        if (closeButton) {
            closeButton.click();
            await delay(1000);
        }
        
        return true;
    }
    
    async function clickLotDetails(button) {
        const row = button.closest('tr[data-symbol]');
        const symbol = row ? row.getAttribute('data-symbol') : 'unknown';
        
        const accountContainer = button.closest('tbody[id*="holdingsAccount_"]');
        const accountId = accountContainer ? accountContainer.id : 'holdingsAccount_unknown';
        
        const uniqueId = `${accountId}-${symbol}`;
        
        if (processedButtons.has(uniqueId)) {
            log(`Button for ${symbol} in account ${accountId} already processed, skipping`);
            return false;
        }
        
        log(`Clicking Next Steps button for: ${symbol} in account ${accountId}`);
        button.click();
        await delay(1500);
        
        const dropdown = document.getElementById('nextStepsList');
        if (!dropdown || !dropdown.classList.contains('show')) {
            log('Dropdown not found or not open');
            return false;
        }
        
        const lotDetailsButton = Array.from(dropdown.querySelectorAll('span')).find(span => 
            span.textContent.trim() === 'Lot Details'
        );
        
        if (!lotDetailsButton) {
            log('Lot Details option not found');
            button.click();
            await delay(500);
            return false;
        }
        
        log('Clicking Lot Details option');
        lotDetailsButton.closest('button').click();
        
        const success = await processLotDetails(accountId, symbol);
        processedButtons.add(uniqueId);
        
        return success;
    }
    
    function findNextStepButtons() {
        const buttons = document.querySelectorAll('sdps-button[sdps-name="Next Steps"]');
        return Array.from(buttons).filter(button => {
            const rect = button.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        });
    }
    
    async function processNextButton() {
        if (currentIndex >= nextStepButtons.length) {
            log('All buttons processed');
            displayResults();
            return;
        }
        
        const button = nextStepButtons[currentIndex];
        log(`Processing button ${currentIndex + 1} of ${nextStepButtons.length}`);
        
        try {
            await clickLotDetails(button);
        } catch (error) {
            log(`Error processing button ${currentIndex}: ${error.message}`);
        }
        
        currentIndex++;
        setTimeout(processNextButton, 2000);
    }
    
    function displayResults() {
        log('=== EXTRACTION COMPLETE ===');
        console.log('Tax Lot Data:', JSON.stringify(taxLotData, null, 2));
        
        const blob = new Blob([JSON.stringify(taxLotData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'schwab-tax-lots.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        const accounts = Object.keys(taxLotData);
        let totalSymbols = 0;
        let totalPositions = 0;
        
        accounts.forEach(accountId => {
            const symbolObjs = taxLotData[accountId];
            symbolObjs.forEach(symbolObj => {
                const symbols = Object.keys(symbolObj);
                totalSymbols += symbols.length;
                symbols.forEach(symbol => {
                    totalPositions += symbolObj[symbol].length;
                });
            });
        });
        
        alert(`Extraction complete! Found ${totalSymbols} symbols across ${accounts.length} accounts with ${totalPositions} total lot entries. Data saved to schwab-tax-lots.json`);
    }
    
    function init() {
        log('Starting tax lot extraction...');
        
        if (!window.location.href.includes('client.schwab.com/app/accounts/positions')) {
            alert('Please navigate to https://client.schwab.com/app/accounts/positions/#/ first');
            return;
        }
        
        nextStepButtons = findNextStepButtons();
        log(`Found ${nextStepButtons.length} Next Steps buttons`);
        
        if (nextStepButtons.length === 0) {
            alert('No Next Steps buttons found. Make sure you are on the positions page.');
            return;
        }
        
        processNextButton();
    }
    
    init();
})();