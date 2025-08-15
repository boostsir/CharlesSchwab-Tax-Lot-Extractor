# Charles Schwab Tax Lot Extractor - Chrome Extension Project Plan

## Project Overview

Build a Chrome Extension that automates the extraction of tax lot data from Charles Schwab's web application positions page. The extension will visit each holding's "Next Steps" menu, click "Lot Details", extract the tax lot information from the modal, and compile all data for export in JSON or CSV format.

## Technical Stack

- **Language**: JavaScript (vanilla ES6+) - NO TypeScript
- **UI Framework**: Vanilla JavaScript with TailwindCSS for styling
- **Build Tool**: None required (pure JavaScript)
- **Testing**: Jest for unit tests, Puppeteer for E2E tests
- **Chrome Extension**: Manifest V3

## Core Functionality Requirements

### 1. Data Extraction Engine

The extension must:

- Detect when user is on `https://client.schwab.com/app/accounts/positions/#/`
- Find all "Next Steps" buttons on the page
- For each button:
  - Click "Next Steps" to open dropdown
  - Click "Lot Details" option
  - Wait for modal to load
  - Extract data from the `#responsiveLotTable` including:
    - Symbol (from modal title)
    - Account ID (from parent tbody element)
    - Open Date
    - Quantity
    - Price
    - Cost Per Share
    - Market Value
    - Cost Basis
    - Gain/Loss ($)
    - Gain/Loss (%)
    - Holding Period (Short/Long)
  - Close modal
  - Move to next position

### 2. User Interface Components

#### Popup (128x200px fixed size)

```html
<!-- popup.html structure -->
<div class="w-full p-4">
  <h1 class="text-lg font-bold mb-4">Tax Lot Extractor</h1>

  <!-- Status Section -->
  <div class="mb-4">
    <div class="text-sm text-gray-600">
      Status: <span id="status">Ready</span>
    </div>
    <div class="text-sm text-gray-600">
      Progress: <span id="progress">0/0</span>
    </div>
  </div>

  <!-- Control Buttons -->
  <button
    id="startBtn"
    class="w-full bg-blue-500 text-white py-2 px-4 rounded mb-2"
  >
    Start Extraction
  </button>
  <button
    id="stopBtn"
    class="w-full bg-red-500 text-white py-2 px-4 rounded mb-2"
    disabled
  >
    Stop
  </button>

  <!-- Export Section -->
  <div class="border-t pt-2 mt-2">
    <button
      id="exportJson"
      class="w-full bg-green-500 text-white py-1 px-2 rounded text-sm mb-1"
      disabled
    >
      Export as JSON
    </button>
    <button
      id="exportCsv"
      class="w-full bg-green-500 text-white py-1 px-2 rounded text-sm"
      disabled
    >
      Export as CSV
    </button>
  </div>
</div>
```

#### Page Overlay

- Semi-transparent overlay showing current processing position
- Progress bar at top of page
- Real-time status messages

### 3. Data Storage Structure

```javascript
// Chrome Storage Structure
{
  extractionState: {
    isRunning: boolean,
    currentIndex: number,
    totalPositions: number,
    lastUpdated: timestamp
  },
  extractedData: {
    [accountId]: [
      {
        [symbol]: [
          {
            open_date: string,
            quantity: number,
            price: number,
            cost_per_share: number,
            market_value: number,
            cost_basis: number,
            gain_or_loss: number,
            gain_or_loss_percentage: number,
            holding_period: string
          }
        ]
      }
    ]
  },
  errors: [
    {
      timestamp: string,
      accountId: string,
      symbol: string,
      error: string
    }
  ]
}
```

## File Structure

```
schwab-tax-lot-extractor/
├── manifest.json
├── popup.html
├── popup.js
├── content.js
├── background.js
├── styles.css (Tailwind CSS)
├── lib/
│   ├── extractor.js      # Core extraction logic
│   ├── exporter.js       # JSON/CSV export functions
│   ├── storage.js        # Chrome storage operations
│   └── utils.js          # Helper functions
├── tests/
│   ├── unit/
│   │   ├── extractor.test.js
│   │   ├── exporter.test.js
│   │   └── utils.test.js
│   └── e2e/
│       └── extraction.test.js
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Development Approach: Test-Driven Development (TDD)

### MANDATORY TDD Process

1. **Write failing tests FIRST** for each function/feature
2. **Implement minimum code** to make tests pass
3. **Refactor** while keeping tests green
4. **Never write production code without a failing test**

### Test Coverage Requirements

- Minimum 80% code coverage
- All core extraction functions must have unit tests
- All export functions must have unit tests
- E2E test for complete extraction flow

### Example Test First Approach

```javascript
// Step 1: Write test first (extractor.test.js)
describe("parseValue", () => {
  test("should parse currency values correctly", () => {
    expect(parseValue("$1,234.56")).toBe(1234.56);
    expect(parseValue("$0.00")).toBe(0);
    expect(parseValue("-$100.50")).toBe(-100.5);
  });
});

// Step 2: Write minimal implementation (extractor.js)
function parseValue(text) {
  if (!text) return 0;
  const cleanText = text.replace(/[$,\s]/g, "");
  return parseFloat(cleanText) || 0;
}

// Step 3: Add more tests for edge cases
test("should handle percentage values", () => {
  expect(parseValue("15.5%")).toBe(15.5);
  expect(parseValue("-5%")).toBe(-5);
});

// Step 4: Update implementation to handle new cases
```

## Implementation Steps

### Phase 1: Setup & Core Extraction (Days 1-3)

#### Day 1: Project Setup & TDD Environment

1. Create folder structure
2. Write `manifest.json`
3. Setup Jest testing environment
4. Write tests for ALL utility functions:
   - `parseValue()` - parse currency/percentage strings
   - `parseDate()` - parse date strings
   - `extractSymbolFromTitle()` - extract symbol from modal title
   - `delay()` - promise-based delay function
5. Implement utility functions to pass tests

#### Day 2: Core Extraction Logic

1. Write tests for extraction functions:
   - `findNextStepButtons()` - locate all buttons
   - `extractLotDetailsFromTable()` - parse table data
   - `processLotDetails()` - complete extraction for one position
2. Implement extraction functions
3. Write integration tests for complete extraction flow

#### Day 3: Chrome Storage Layer

1. Write tests for storage operations:
   - `saveProgress()` - save current state
   - `loadProgress()` - retrieve state
   - `clearData()` - reset storage
   - `saveExtractedData()` - store lot data
2. Implement storage.js module
3. Test error handling and recovery

### Phase 2: User Interface (Days 4-5)

#### Day 4: Popup Interface

1. Create popup.html with TailwindCSS
2. Write tests for popup.js functions:
   - `updateStatus()` - update UI status
   - `handleStartClick()` - initiate extraction
   - `handleStopClick()` - stop extraction
3. Implement popup.js with message passing to content script
4. Add Chrome runtime message handlers

#### Day 5: Page Overlay & Progress

1. Write tests for overlay functions:
   - `createOverlay()` - inject overlay HTML
   - `updateProgress()` - update progress bar
   - `showCurrentPosition()` - highlight current element
2. Implement overlay injection in content script
3. Style overlay with TailwindCSS

### Phase 3: Export & Error Handling (Days 6-7)

#### Day 6: Export Functionality

1. Write tests for export functions:
   - `convertToCSV()` - convert JSON to CSV format
   - `downloadFile()` - trigger file download
   - `formatJSONExport()` - prepare JSON for export
2. Implement exporter.js module
3. Add export buttons functionality to popup

#### Day 7: Error Handling & Recovery

1. Write tests for error scenarios:
   - Modal fails to open
   - Table data missing
   - Page navigation during extraction
   - Network timeouts
2. Implement retry logic with exponential backoff
3. Add error logging and user notifications
4. Implement resume capability after interruption

### Phase 4: Testing & Polish (Days 8-9)

#### Day 8: End-to-End Testing

1. Create mock Schwab page for testing
2. Write Puppeteer E2E tests:
   - Complete extraction flow
   - Error recovery
   - Export functionality
3. Performance testing with large datasets

#### Day 9: Final Polish

1. Add input validation
2. Optimize extraction speed
3. Add keyboard shortcuts
4. Create user documentation
5. Package extension for distribution

## Critical Implementation Details

### Message Passing Architecture

```javascript
// popup.js -> background.js -> content.js
// Use Chrome runtime messaging for all communication

// Popup sends command
chrome.runtime.sendMessage({ action: "START_EXTRACTION" });

// Background forwards to content
chrome.tabs.sendMessage(tabId, { action: "START_EXTRACTION" });

// Content sends progress updates
chrome.runtime.sendMessage({
  action: "PROGRESS_UPDATE",
  data: { current: 5, total: 20 },
});
```

### Error Recovery Strategy

```javascript
// Implement exponential backoff
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
```

### State Management

- Use Chrome Storage API for persistence
- Save progress after each successful extraction
- Clear data only on user request or successful completion
- Implement automatic resume on extension restart

## Performance Requirements

- Process each position within 5 seconds
- Handle portfolios with 100+ positions
- Memory usage under 50MB
- Support concurrent tab usage (non-blocking)

## Browser Compatibility

- Chrome version 88+ (Manifest V3 support)
- Handle dynamic page updates (React-based Schwab app)
- Work with both light and dark themes

## Security Considerations

- No external network requests
- All data processed locally
- Sensitive data cleared from memory after export
- Content Security Policy compliant

## Success Criteria

1. Successfully extracts all tax lots from Schwab positions page
2. Handles errors gracefully with retry logic
3. Exports data in JSON and CSV formats
4. Provides clear progress feedback to user
5. Resumes extraction if interrupted
6. Passes all unit and E2E tests
7. Works reliably on portfolios with 50+ positions

## Testing Checklist

- [ ] All utility functions have unit tests
- [ ] Extraction logic tested with mock DOM
- [ ] Storage operations tested
- [ ] Export functions produce valid JSON/CSV
- [ ] Error scenarios handled properly
- [ ] E2E test passes on mock Schwab page
- [ ] Manual testing on real Schwab account
- [ ] Performance acceptable for large portfolios

## AI Agent Instructions

1. **Follow TDD strictly** - Write tests before implementation
2. **Use only vanilla JavaScript** - No TypeScript, no frameworks except TailwindCSS
3. **Keep functions small** - Each function should do one thing
4. **Comment complex logic** - Explain non-obvious code
5. **Handle all errors** - Never let the extension crash
6. **Test edge cases** - Empty data, malformed HTML, etc.
7. **Use semantic HTML** - Proper ARIA labels for accessibility
8. **Optimize selectors** - Cache DOM queries when possible

Start by creating the project structure and writing tests for the utility functions. Do not proceed to implementation until all tests are written.
