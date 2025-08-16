# Charles Schwab Tax Lot Extractor - Chrome Extension

A Chrome Extension that automates the extraction of tax lot data from Charles Schwab's positions page, built following Test-Driven Development (TDD) principles.

## Features

- **Automated Extraction**: Automatically clicks through all "Next Steps" buttons and extracts lot details
- **Progress Tracking**: Visual progress bar and status updates during extraction
- **Resume Capability**: Can resume interrupted extractions automatically
- **Export Options**: Export data in JSON or CSV format
- **Error Handling**: Comprehensive error handling with retry logic
- **Storage**: Persistent storage using Chrome Storage API

## Installation

### From Chrome Web Store

[**🚀 Install from Chrome Web Store**](https://chromewebstore.google.com/detail/nfngfaakmkihccflfeikhdogangajljc)

### For Developers

1. Clone or download this repository
2. Run `npm run build` to create the distribution package
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" in the top right
5. Click "Load unpacked" and select the `dist` directory
6. The extension icon should appear in your Chrome toolbar

## Usage

1. Navigate to `https://client.schwab.com/app/accounts/positions/#/`
2. Click the extension icon in your toolbar
3. Click "Start Extraction" to begin automated lot detail extraction
4. The extension will show progress and highlight the current position being processed
5. Once complete, use "Export as JSON" or "Export as CSV" to download your data

## File Structure

```
schwab-tax-lot-extractor/
├── manifest.json           # Extension manifest
├── popup.html              # Extension popup UI
├── popup.js                # Popup logic and messaging
├── content.js              # Main content script
├── background.js           # Background service worker
├── styles.css              # TailwindCSS styling
├── lib/
│   ├── utils.js            # Utility functions
│   ├── extractor.js        # Core extraction logic
│   ├── storage.js          # Chrome storage operations
│   └── exporter.js         # JSON/CSV export functions
├── tests/
│   ├── setup.js            # Jest test setup
│   └── unit/               # Unit tests for all modules
├── icons/                  # Extension icons (16px, 48px, 128px)
└── package.json            # Jest configuration
```

## Data Structure

The extension organizes extracted tax lot data hierarchically:

```javascript
{
  "holdingsAccount_[ID]": [
    {
      "[SYMBOL]": [
        {
          "open_date": "MM/DD/YYYY",
          "quantity": 100,
          "price": 150.00,
          "cost_per_share": 150.00,
          "market_value": 15000.00,
          "cost_basis": 15000.00,
          "gain_or_loss": 500.00,
          "gain_or_loss_percentage": 3.33,
          "holding_period": "Long"
        }
      ]
    }
  ]
}
```

## Development

### Building for Distribution

```bash
npm run build              # Create dist/ folder and .zip file for Chrome Web Store
```

This creates:

- `dist/` folder with all extension files ready for development
- `schwab-tax-lot-extractor-v{version}.zip` ready for Chrome Web Store upload

### Running Tests

```bash
npm test                    # Run all tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Run tests with coverage report
```

### Test Coverage

The project maintains 80%+ test coverage across all modules:

- ✅ 52 passing tests
- ✅ Utils, Extractor, Storage, and Exporter modules fully tested
- ✅ TDD approach followed throughout development

### Architecture

The extension uses a message-passing architecture:

1. **Popup** → **Background** → **Content Script** for commands
2. **Content Script** → **Background** → **Popup** for status updates
3. **Chrome Storage API** for data persistence and state management

### Key Components

- **Extraction Engine**: Processes Schwab's DOM structure to extract lot details
- **State Management**: Tracks progress and handles interruption/resume
- **Export System**: Converts data to JSON/CSV with proper formatting
- **Error Handling**: Retry logic with exponential backoff for reliability

## Browser Compatibility

- Chrome version 88+ (Manifest V3 support)
- Works with Schwab's React-based web application
- Handles dynamic page updates and loading states

## Security

- No external network requests
- All data processed locally in the browser
- Sensitive data cleared from memory after export
- Content Security Policy compliant

## Performance

- Processes each position within 5 seconds
- Handles portfolios with 100+ positions
- Memory usage under 50MB
- Supports concurrent tab usage

## Troubleshooting

### Common Issues

1. **"No buttons found"**: Ensure you're on the correct Schwab positions page
2. **Extraction fails**: Check that you're logged into Schwab and can see your positions
3. **Modal doesn't open**: Some positions may not have lot details available

### Error Recovery

The extension includes automatic retry logic and can resume from where it left off if interrupted.

## Development Notes

This extension was built using:

- **Pure JavaScript** (no TypeScript or frameworks)
- **TDD methodology** (tests written before implementation)
- **Vanilla DOM APIs** for maximum compatibility
- **Chrome Extension Manifest V3**

Based on the proven logic from the original bookmarklet script that has been manually tested and validated.
