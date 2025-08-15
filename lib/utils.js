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
    if (!titleText) return null;
    const match = titleText.match(/Lot Details:\s*([A-Z\/]+)\s*-/);
    return match ? match[1] : null;
}

const MAX_RETRIES = 3;
const BASE_DELAY = 1000;

async function withRetry(fn, retries = MAX_RETRIES) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === retries - 1) throw error;
            await delay(BASE_DELAY * Math.pow(2, i));
        }
    }
}

// Export functions for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        log,
        delay,
        parseValue,
        parseDate,
        extractSymbolFromTitle,
        withRetry
    };
}