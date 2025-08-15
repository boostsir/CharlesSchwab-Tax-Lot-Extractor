document.addEventListener('DOMContentLoaded', async () => {
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const exportJsonBtn = document.getElementById('exportJson');
  const exportCsvBtn = document.getElementById('exportCsv');
  const statusEl = document.getElementById('status');
  const progressEl = document.getElementById('progress');
  const errorDisplay = document.getElementById('errorDisplay');

  // Load initial state
  await updateUI();

  // Event listeners
  startBtn.addEventListener('click', handleStartClick);
  stopBtn.addEventListener('click', handleStopClick);
  exportJsonBtn.addEventListener('click', () => handleExportClick('json'));
  exportCsvBtn.addEventListener('click', () => handleExportClick('csv'));

  // Listen for messages from background/content scripts
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message);
  });

  async function handleStartClick() {
    try {
      // Check if we're on the correct page
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url.includes('client.schwab.com/app/accounts/positions')) {
        showError('Please navigate to the Schwab positions page first');
        return;
      }

      // Send start message to content script
      chrome.runtime.sendMessage({
        action: 'START_EXTRACTION',
        tabId: tab.id
      }, (response) => {
        // Handle response or error
        if (chrome.runtime.lastError) {
          console.error('Message sending error:', chrome.runtime.lastError);
        }
      });

      updateStatus('Starting extraction...', '0/0');
      setButtonStates(false, true, false, false);
      hideError();

    } catch (error) {
      showError('Failed to start extraction: ' + error.message);
    }
  }

  async function handleStopClick() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      chrome.runtime.sendMessage({
        action: 'STOP_EXTRACTION',
        tabId: tab.id
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Message sending error:', chrome.runtime.lastError);
        }
      });

      updateStatus('Stopping...', '0/0');
      setButtonStates(false, false, false, false);

    } catch (error) {
      showError('Failed to stop extraction: ' + error.message);
    }
  }

  async function handleExportClick(format) {
    try {
      chrome.runtime.sendMessage({
        action: 'EXPORT_DATA',
        format: format
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Message sending error:', chrome.runtime.lastError);
        }
      });
    } catch (error) {
      showError('Failed to export data: ' + error.message);
    }
  }

  function handleMessage(message) {
    switch (message.action) {
      case 'PROGRESS_UPDATE':
        updateStatus(message.data.status, `${message.data.current}/${message.data.total}`);
        break;

      case 'EXTRACTION_COMPLETE':
        updateStatus('Complete', `${message.data.total}/${message.data.total}`);
        setButtonStates(true, false, true, true);
        break;

      case 'EXTRACTION_ERROR':
        updateStatus('Error', message.data.progress || '0/0');
        setButtonStates(true, false, false, false);
        showError(message.data.error);
        break;

      case 'EXTRACTION_STOPPED':
        updateStatus('Stopped', message.data.progress || '0/0');
        setButtonStates(true, false, message.data.hasData, message.data.hasData);
        break;

      case 'EXPORT_COMPLETE':
        showSuccess(`Data exported as ${message.data.format.toUpperCase()}`);
        break;
    }
  }

  async function updateUI() {
    try {
      // Get current progress from storage
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'GET_STATE' }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      });
      
      if (response && response.progress) {
        const { isRunning, currentIndex, totalPositions } = response.progress;
        const hasData = response.hasData || false;
        
        if (isRunning) {
          updateStatus('Running', `${currentIndex}/${totalPositions}`);
          setButtonStates(false, true, false, false);
        } else {
          updateStatus('Ready', `${currentIndex}/${totalPositions}`);
          setButtonStates(true, false, hasData, hasData);
        }
      }
    } catch (error) {
      console.error('Failed to update UI:', error);
      // Set default state on error
      updateStatus('Ready', '0/0');
      setButtonStates(true, false, false, false);
    }
  }

  function updateStatus(status, progress) {
    statusEl.textContent = status;
    progressEl.textContent = progress;
  }

  function setButtonStates(start, stop, exportJson, exportCsv) {
    startBtn.disabled = !start;
    stopBtn.disabled = !stop;
    exportJsonBtn.disabled = !exportJson;
    exportCsvBtn.disabled = !exportCsv;
  }

  function showError(message) {
    errorDisplay.textContent = message;
    errorDisplay.classList.remove('hidden');
    errorDisplay.style.color = '#dc2626';
  }

  function showSuccess(message) {
    errorDisplay.textContent = message;
    errorDisplay.classList.remove('hidden');
    errorDisplay.style.color = '#059669';
    
    // Hide success message after 3 seconds
    setTimeout(() => {
      hideError();
    }, 3000);
  }

  function hideError() {
    errorDisplay.classList.add('hidden');
  }
});