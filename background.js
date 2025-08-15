// Background script for the Schwab Tax Lot Extractor
chrome.runtime.onInstalled.addListener(() => {
  console.log('Schwab Tax Lot Extractor installed');
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true; // Keep the message channel open for async responses
});

async function handleMessage(message, sender, sendResponse) {
  try {
    switch (message.action) {
      case 'START_EXTRACTION':
        await handleStartExtraction(message, sender);
        sendResponse({ success: true });
        break;
        
      case 'STOP_EXTRACTION':
        await handleStopExtraction(message, sender);
        sendResponse({ success: true });
        break;
        
      case 'GET_STATE':
        const state = await getExtractionState();
        sendResponse(state);
        break;
        
      case 'EXPORT_DATA':
        await handleExportData(message, sender);
        sendResponse({ success: true });
        break;
        
      case 'PROGRESS_UPDATE':
      case 'EXTRACTION_COMPLETE':
      case 'EXTRACTION_ERROR':
      case 'EXTRACTION_STOPPED':
        // Forward messages from content script to popup
        await forwardToPopup(message);
        sendResponse({ success: true });
        break;
        
      default:
        sendResponse({ error: 'Unknown action' });
        break;
    }
  } catch (error) {
    console.error('Background script error:', error);
    sendResponse({ error: error.message });
  }
}

async function handleStartExtraction(message, sender) {
  const tabId = message.tabId || sender.tab?.id;
  
  if (!tabId) {
    console.error('No tab ID provided for extraction');
    return;
  }

  try {
    // Send message to content script
    await chrome.tabs.sendMessage(tabId, {
      action: 'START_EXTRACTION'
    });
  } catch (error) {
    console.error('Failed to start extraction:', error);
    // Notify popup of error
    await forwardToPopup({
      action: 'EXTRACTION_ERROR',
      data: { error: 'Failed to communicate with page content' }
    });
  }
}

async function handleStopExtraction(message, sender) {
  const tabId = message.tabId || sender.tab?.id;
  
  if (!tabId) {
    console.error('No tab ID provided for stopping extraction');
    return;
  }

  try {
    await chrome.tabs.sendMessage(tabId, {
      action: 'STOP_EXTRACTION'
    });
  } catch (error) {
    console.error('Failed to stop extraction:', error);
  }
}

async function getExtractionState() {
  try {
    // Get state from storage
    const progress = await new Promise((resolve) => {
      chrome.storage.local.get(['extractionState'], (result) => {
        const defaultProgress = {
          isRunning: false,
          currentIndex: 0,
          totalPositions: 0,
          lastUpdated: null
        };
        resolve(result.extractionState || defaultProgress);
      });
    });

    const extractedData = await new Promise((resolve) => {
      chrome.storage.local.get(['extractedData'], (result) => {
        resolve(result.extractedData || {});
      });
    });

    return {
      progress: progress,
      hasData: Object.keys(extractedData).length > 0
    };
  } catch (error) {
    console.error('Failed to get extraction state:', error);
    return {
      progress: {
        isRunning: false,
        currentIndex: 0,
        totalPositions: 0,
        lastUpdated: null
      },
      hasData: false
    };
  }
}

async function handleExportData(message, sender) {
  try {
    // Get extracted data from storage
    const extractedData = await new Promise((resolve) => {
      chrome.storage.local.get(['extractedData'], (result) => {
        resolve(result.extractedData || {});
      });
    });

    if (Object.keys(extractedData).length === 0) {
      await forwardToPopup({
        action: 'EXTRACTION_ERROR',
        data: { error: 'No data available to export' }
      });
      return;
    }

    // Get active tab to inject export script
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      await forwardToPopup({
        action: 'EXTRACTION_ERROR',
        data: { error: 'No active tab found' }
      });
      return;
    }

    // Inject export script
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: downloadFile,
      args: [extractedData, message.format]
    });

    // Notify popup of successful export
    await forwardToPopup({
      action: 'EXPORT_COMPLETE',
      data: { format: message.format }
    });

  } catch (error) {
    console.error('Failed to export data:', error);
    await forwardToPopup({
      action: 'EXTRACTION_ERROR',
      data: { error: 'Failed to export data: ' + error.message }
    });
  }
}

async function forwardToPopup(message) {
  try {
    // Try to send to popup if it's open
    await chrome.runtime.sendMessage(message);
  } catch (error) {
    // Popup might not be open, that's okay
    console.log('Popup not available to receive message');
  }
}

// Function to be injected into page for downloading files
function downloadFile(data, format) {
  let content, filename, mimeType;

  if (format === 'json') {
    content = JSON.stringify(data, null, 2);
    filename = 'schwab-tax-lots.json';
    mimeType = 'application/json';
  } else if (format === 'csv') {
    content = convertToCSV(data);
    filename = 'schwab-tax-lots.csv';
    mimeType = 'text/csv';
  } else {
    throw new Error('Unsupported export format');
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  function convertToCSV(taxLotData) {
    const headers = [
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

    const rows = [headers.join(',')];

    Object.entries(taxLotData).forEach(([accountId, symbolArray]) => {
      symbolArray.forEach(symbolObj => {
        Object.entries(symbolObj).forEach(([symbol, lots]) => {
          lots.forEach(lot => {
            const row = [
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
            rows.push(row.join(','));
          });
        });
      });
    });

    return rows.join('\n');
  }
}