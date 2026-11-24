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

    // Snapshot every position that has a Cost Basis button (opens Lot Details)
    const positions = findLotDetailPositions();
    log(`Found ${positions.length} positions with Cost Basis buttons`);

    if (positions.length === 0) {
      sendProgressUpdate("Error: No buttons found", 0, 0);
      return;
    }

    // Initialize extraction state
    extractionState.isRunning = true;
    extractionState.currentIndex = 0;
    extractionState.totalPositions = positions.length;
    extractionState.processedButtons.clear();
    extractionState.taxLotData = {};
    extractionState.errors = [];

    await saveState();

    // Create overlay
    createOverlay();

    // Start processing
    sendProgressUpdate("Starting extraction...", 0, positions.length);
    processNextButton(positions);
  } catch (error) {
    log("Error starting extraction:", error);
    sendError("Failed to start extraction: " + error.message);
  }
}

async function processNextButton(positions) {
  if (
    !extractionState.isRunning ||
    extractionState.currentIndex >= positions.length
  ) {
    await completeExtraction();
    return;
  }

  const position = positions[extractionState.currentIndex];
  const currentPosition = extractionState.currentIndex + 1;

  log(`Processing position ${currentPosition} of ${positions.length}`);
  sendProgressUpdate("Processing position...", currentPosition, positions.length);

  let button = null;
  try {
    const result = await withRetry(async () => {
      // Look the button up fresh each attempt: Schwab re-renders the table
      // periodically, which detaches buttons found earlier.
      button = findLotDetailButtonFor(position);
      if (!button) {
        throw new Error(`Cost Basis button not found for ${position.symbol}`);
      }
      highlightElement(button);
      const attempt = await clickLotDetails(button, extractionState.processedButtons);
      if (!attempt.success && !attempt.processed) {
        throw new Error(`Lot Details did not open for ${position.symbol}`);
      }
      return attempt;
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
    }
  } catch (error) {
    log(`Error processing position ${currentPosition}:`, error);
    extractionState.errors.push({
      timestamp: new Date().toISOString(),
      accountId: position.accountId,
      symbol: position.symbol,
      error: error.message,
    });
  }

  if (button) {
    unhighlightElement(button);
  }

  // Update progress
  extractionState.currentIndex++;
  await saveState();

  // Continue with next button after delay
  setTimeout(() => {
    processNextButton(positions);
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

  const positions = findLotDetailPositions();
  if (positions.length === 0) {
    extractionState.isRunning = false;
    await saveState();
    return;
  }

  createOverlay();
  processNextButton(positions);
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
