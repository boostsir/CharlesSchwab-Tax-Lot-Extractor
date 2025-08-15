// Main content script for the Charles Schwab Tax Lot Extractor
let extractionState = {
  isRunning: false,
  currentIndex: 0,
  totalPositions: 0,
  processedButtons: new Set(),
  taxLotData: {},
  errors: [],
};

let overlay = null;
let progressBar = null;

// Initialize the content script
async function init() {
  log("Content script initialized");

  // Load previous state if available
  await loadState();

  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener(handleMessage);

  // Check if extraction was interrupted and should resume
  if (extractionState.isRunning) {
    resumeExtraction();
  }
}

function handleMessage(message, sender, sendResponse) {
  switch (message.action) {
    case "START_EXTRACTION":
      startExtraction();
      sendResponse({ success: true });
      break;

    case "STOP_EXTRACTION":
      stopExtraction();
      sendResponse({ success: true });
      break;

    case "GET_STATE":
      sendResponse({
        progress: {
          isRunning: extractionState.isRunning,
          currentIndex: extractionState.currentIndex,
          totalPositions: extractionState.totalPositions,
        },
        hasData: Object.keys(extractionState.taxLotData).length > 0,
      });
      break;

    default:
      sendResponse({ error: "Unknown action" });
      break;
  }
}

async function startExtraction() {
  if (extractionState.isRunning) {
    log("Extraction already running");
    return;
  }

  try {
    // Verify we're on the correct page
    if (
      !window.location.href.includes("client.schwab.com/app/accounts/positions")
    ) {
      sendProgressUpdate("Error: Wrong page", 0, 0);
      return;
    }

    // Find all Next Steps buttons
    const buttons = findNextStepButtons();
    log(`Found ${buttons.length} Next Steps buttons`);

    if (buttons.length === 0) {
      sendProgressUpdate("Error: No buttons found", 0, 0);
      return;
    }

    // Initialize extraction state
    extractionState.isRunning = true;
    extractionState.currentIndex = 0;
    extractionState.totalPositions = buttons.length;
    extractionState.processedButtons.clear();
    extractionState.taxLotData = {};
    extractionState.errors = [];

    await saveState();

    // Create overlay
    createOverlay();

    // Start processing
    sendProgressUpdate("Starting extraction...", 0, buttons.length);
    processNextButton(buttons);
  } catch (error) {
    log("Error starting extraction:", error);
    sendError("Failed to start extraction: " + error.message);
  }
}

async function processNextButton(buttons) {
  if (
    !extractionState.isRunning ||
    extractionState.currentIndex >= buttons.length
  ) {
    await completeExtraction();
    return;
  }

  const button = buttons[extractionState.currentIndex];
  const currentPosition = extractionState.currentIndex + 1;

  log(`Processing button ${currentPosition} of ${buttons.length}`);
  sendProgressUpdate("Processing position...", currentPosition, buttons.length);

  // Highlight current button
  highlightElement(button);

  try {
    const result = await withRetry(async () => {
      return await clickLotDetails(button, extractionState.processedButtons);
    });

    if (result.success && result.lots) {
      createTaxLotEntry(
        extractionState.taxLotData,
        result.accountId,
        result.symbol,
        result.lots
      );
      log(
        `Successfully extracted ${result.lots.length} lots for ${result.symbol}`
      );
    } else if (!result.processed) {
      // Add to errors if it wasn't already processed
      extractionState.errors.push({
        timestamp: new Date().toISOString(),
        accountId: result.accountId || "unknown",
        symbol: result.symbol || "unknown",
        error: "Failed to extract lot details",
      });
    }
  } catch (error) {
    log(`Error processing button ${currentPosition}:`, error);
    const symbol = getSymbolFromRow(button);
    const accountId = getAccountIdFromElement(button);

    extractionState.errors.push({
      timestamp: new Date().toISOString(),
      accountId: accountId,
      symbol: symbol,
      error: error.message,
    });
  }

  // Remove highlight
  unhighlightElement(button);

  // Update progress
  extractionState.currentIndex++;
  await saveState();

  // Continue with next button after delay
  setTimeout(() => {
    processNextButton(buttons);
  }, 2000);
}

async function completeExtraction() {
  extractionState.isRunning = false;
  await saveState();

  removeOverlay();

  const totalSymbols = countSymbols(extractionState.taxLotData);
  const totalPositions = countPositions(extractionState.taxLotData);

  log(
    `Extraction complete! Found ${totalSymbols} symbols with ${totalPositions} total positions`
  );

  chrome.runtime.sendMessage({
    action: "EXTRACTION_COMPLETE",
    data: {
      total: extractionState.totalPositions,
      symbols: totalSymbols,
      positions: totalPositions,
      errors: extractionState.errors.length,
    },
  });
}

async function stopExtraction() {
  if (!extractionState.isRunning) {
    return;
  }

  extractionState.isRunning = false;
  await saveState();

  removeOverlay();

  chrome.runtime.sendMessage({
    action: "EXTRACTION_STOPPED",
    data: {
      progress: `${extractionState.currentIndex}/${extractionState.totalPositions}`,
      hasData: Object.keys(extractionState.taxLotData).length > 0,
    },
  });
}

async function resumeExtraction() {
  log("Resuming interrupted extraction...");

  const buttons = findNextStepButtons();
  if (buttons.length === 0) {
    extractionState.isRunning = false;
    await saveState();
    return;
  }

  createOverlay();
  processNextButton(buttons);
}

function createOverlay() {
  // Create progress bar
  progressBar = document.createElement("div");
  progressBar.className = "schwab-extractor-progress";
  progressBar.innerHTML =
    '<div class="schwab-extractor-progress-bar" style="width: 0%"></div>';
  document.body.appendChild(progressBar);

  // Create status overlay
  overlay = document.createElement("div");
  overlay.className = "schwab-extractor-overlay";
  overlay.innerHTML = `
    <div class="schwab-extractor-status">
      <h3 style="margin: 0 0 1rem 0; font-size: 1.125rem; font-weight: bold;">Tax Lot Extraction in Progress</h3>
      <p style="margin: 0 0 0.5rem 0; color: #4b5563;">Processing position <span id="current-position">0</span> of <span id="total-positions">0</span></p>
      <p style="margin: 0; color: #6b7280; font-size: 0.875rem;">Please do not navigate away from this page</p>
    </div>
  `;
  document.body.appendChild(overlay);
}

function removeOverlay() {
  if (progressBar) {
    progressBar.remove();
    progressBar = null;
  }
  if (overlay) {
    overlay.remove();
    overlay = null;
  }
}

function updateProgressBar(current, total) {
  if (progressBar) {
    const percentage = total > 0 ? (current / total) * 100 : 0;
    const bar = progressBar.querySelector(".schwab-extractor-progress-bar");
    if (bar) {
      bar.style.width = `${percentage}%`;
    }
  }

  if (overlay) {
    const currentEl = overlay.querySelector("#current-position");
    const totalEl = overlay.querySelector("#total-positions");
    if (currentEl) currentEl.textContent = current;
    if (totalEl) totalEl.textContent = total;
  }
}

function highlightElement(element) {
  element.classList.add("schwab-extractor-highlight");
}

function unhighlightElement(element) {
  element.classList.remove("schwab-extractor-highlight");
}

function sendProgressUpdate(status, current, total) {
  updateProgressBar(current, total);

  chrome.runtime.sendMessage({
    action: "PROGRESS_UPDATE",
    data: {
      status: status,
      current: current,
      total: total,
    },
  });
}

function sendError(error) {
  chrome.runtime.sendMessage({
    action: "EXTRACTION_ERROR",
    data: {
      error: error,
      progress: `${extractionState.currentIndex}/${extractionState.totalPositions}`,
    },
  });
}

async function saveState() {
  await saveProgress({
    isRunning: extractionState.isRunning,
    currentIndex: extractionState.currentIndex,
    totalPositions: extractionState.totalPositions,
    lastUpdated: Date.now(),
  });

  await saveExtractedData(extractionState.taxLotData);
  await saveErrors(extractionState.errors);
}

async function loadState() {
  try {
    const progress = await loadProgress();
    const data = await loadExtractedData();
    const errors = await loadErrors();

    extractionState.isRunning = progress.isRunning;
    extractionState.currentIndex = progress.currentIndex;
    extractionState.totalPositions = progress.totalPositions;
    extractionState.taxLotData = data;
    extractionState.errors = errors;
  } catch (error) {
    log("Error loading state:", error);
  }
}

function countSymbols(taxLotData) {
  let count = 0;
  Object.values(taxLotData).forEach((accountData) => {
    accountData.forEach((symbolObj) => {
      count += Object.keys(symbolObj).length;
    });
  });
  return count;
}

function countPositions(taxLotData) {
  let count = 0;
  Object.values(taxLotData).forEach((accountData) => {
    accountData.forEach((symbolObj) => {
      Object.values(symbolObj).forEach((lots) => {
        count += lots.length;
      });
    });
  });
  return count;
}

// Initialize when page loads
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
