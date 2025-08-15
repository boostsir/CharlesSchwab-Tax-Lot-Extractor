const { 
  saveProgress, 
  loadProgress, 
  clearData, 
  saveExtractedData,
  loadExtractedData,
  saveErrors,
  loadErrors,
  clearErrors
} = require('../../lib/storage');

describe('Storage Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chrome.storage.local.get.mockReset();
    chrome.storage.local.set.mockReset();
    chrome.storage.local.clear.mockReset();
  });

  describe('saveProgress', () => {
    test('should save extraction progress to storage', async () => {
      const progress = {
        isRunning: true,
        currentIndex: 5,
        totalPositions: 20,
        lastUpdated: Date.now()
      };

      chrome.storage.local.set.mockResolvedValue();

      await saveProgress(progress);

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        extractionState: progress
      });
    });

    test('should handle storage errors', async () => {
      const progress = { isRunning: true };
      const error = new Error('Storage error');
      
      chrome.storage.local.set.mockRejectedValue(error);

      await expect(saveProgress(progress)).rejects.toThrow('Storage error');
    });
  });

  describe('loadProgress', () => {
    test('should load extraction progress from storage', async () => {
      const progress = {
        isRunning: false,
        currentIndex: 0,
        totalPositions: 0,
        lastUpdated: null
      };

      chrome.storage.local.get.mockResolvedValue({
        extractionState: progress
      });

      const result = await loadProgress();

      expect(chrome.storage.local.get).toHaveBeenCalledWith(['extractionState']);
      expect(result).toEqual(progress);
    });

    test('should return default progress when nothing stored', async () => {
      chrome.storage.local.get.mockResolvedValue({});

      const result = await loadProgress();

      expect(result).toEqual({
        isRunning: false,
        currentIndex: 0,
        totalPositions: 0,
        lastUpdated: null
      });
    });
  });

  describe('saveExtractedData', () => {
    test('should save tax lot data to storage', async () => {
      const data = {
        'holdingsAccount_123': [
          { 'AAPL': [{ open_date: '01/15/2023', quantity: 100 }] }
        ]
      };

      chrome.storage.local.set.mockResolvedValue();

      await saveExtractedData(data);

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        extractedData: data
      });
    });
  });

  describe('loadExtractedData', () => {
    test('should load tax lot data from storage', async () => {
      const data = {
        'holdingsAccount_123': [
          { 'AAPL': [{ open_date: '01/15/2023', quantity: 100 }] }
        ]
      };

      chrome.storage.local.get.mockResolvedValue({
        extractedData: data
      });

      const result = await loadExtractedData();

      expect(chrome.storage.local.get).toHaveBeenCalledWith(['extractedData']);
      expect(result).toEqual(data);
    });

    test('should return empty object when no data stored', async () => {
      chrome.storage.local.get.mockResolvedValue({});

      const result = await loadExtractedData();

      expect(result).toEqual({});
    });
  });

  describe('saveErrors', () => {
    test('should save error logs to storage', async () => {
      const errors = [
        {
          timestamp: '2023-01-15T10:00:00Z',
          accountId: 'holdingsAccount_123',
          symbol: 'AAPL',
          error: 'Modal not found'
        }
      ];

      chrome.storage.local.set.mockResolvedValue();

      await saveErrors(errors);

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        errors: errors
      });
    });
  });

  describe('loadErrors', () => {
    test('should load error logs from storage', async () => {
      const errors = [
        {
          timestamp: '2023-01-15T10:00:00Z',
          accountId: 'holdingsAccount_123',
          symbol: 'AAPL',
          error: 'Modal not found'
        }
      ];

      chrome.storage.local.get.mockResolvedValue({
        errors: errors
      });

      const result = await loadErrors();

      expect(chrome.storage.local.get).toHaveBeenCalledWith(['errors']);
      expect(result).toEqual(errors);
    });

    test('should return empty array when no errors stored', async () => {
      chrome.storage.local.get.mockResolvedValue({});

      const result = await loadErrors();

      expect(result).toEqual([]);
    });
  });

  describe('clearErrors', () => {
    test('should clear all errors from storage', async () => {
      chrome.storage.local.set.mockResolvedValue();

      await clearErrors();

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        errors: []
      });
    });
  });

  describe('clearData', () => {
    test('should clear all data from storage', async () => {
      chrome.storage.local.clear.mockResolvedValue();

      await clearData();

      expect(chrome.storage.local.clear).toHaveBeenCalled();
    });

    test('should handle storage errors', async () => {
      const error = new Error('Storage error');
      chrome.storage.local.clear.mockRejectedValue(error);

      await expect(clearData()).rejects.toThrow('Storage error');
    });
  });
});