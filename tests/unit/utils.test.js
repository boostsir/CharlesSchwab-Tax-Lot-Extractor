const { log, delay, parseValue, parseDate, extractSymbolFromTitle, withRetry } = require('../../lib/utils');

describe('Utility Functions', () => {
  describe('parseValue', () => {
    test('should parse currency values correctly', () => {
      expect(parseValue('$1,234.56')).toBe(1234.56);
      expect(parseValue('$0.00')).toBe(0);
      expect(parseValue('-$100.50')).toBe(-100.5);
      expect(parseValue('$1,000')).toBe(1000);
    });

    test('should parse percentage values correctly', () => {
      expect(parseValue('15.5%')).toBe(15.5);
      expect(parseValue('-5%')).toBe(-5);
      expect(parseValue('0%')).toBe(0);
      expect(parseValue('100.25%')).toBe(100.25);
    });

    test('should parse plain numeric values', () => {
      expect(parseValue('123.45')).toBe(123.45);
      expect(parseValue('0')).toBe(0);
      expect(parseValue('-50.25')).toBe(-50.25);
      expect(parseValue('1000')).toBe(1000);
    });

    test('should handle edge cases', () => {
      expect(parseValue('')).toBe(0);
      expect(parseValue(null)).toBe(0);
      expect(parseValue(undefined)).toBe(0);
      expect(parseValue('invalid')).toBe(0);
      expect(parseValue('$')).toBe(0);
    });

    test('should handle values with extra spaces', () => {
      expect(parseValue(' $1,234.56 ')).toBe(1234.56);
      expect(parseValue('  15.5%  ')).toBe(15.5);
      expect(parseValue(' 123.45 ')).toBe(123.45);
    });
  });

  describe('parseDate', () => {
    test('should return trimmed date string', () => {
      expect(parseDate('01/15/2023')).toBe('01/15/2023');
      expect(parseDate(' 12/31/2022 ')).toBe('12/31/2022');
      expect(parseDate('05/10/2024')).toBe('05/10/2024');
    });

    test('should handle edge cases', () => {
      expect(parseDate('')).toBe('');
      expect(parseDate(null)).toBe('');
      expect(parseDate(undefined)).toBe('');
      expect(parseDate('   ')).toBe('');
    });
  });

  describe('extractSymbolFromTitle', () => {
    test('should extract symbol from modal title', () => {
      expect(extractSymbolFromTitle('Lot Details: AAPL - Apple Inc.')).toBe('AAPL');
      expect(extractSymbolFromTitle('Lot Details: MSFT - Microsoft Corporation')).toBe('MSFT');
      expect(extractSymbolFromTitle('Lot Details: BRK/B - Berkshire Hathaway Inc.')).toBe('BRK/B');
      expect(extractSymbolFromTitle('Lot Details: SPY - SPDR S&P 500 ETF Trust')).toBe('SPY');
    });

    test('should handle edge cases', () => {
      expect(extractSymbolFromTitle('Invalid title')).toBe(null);
      expect(extractSymbolFromTitle('')).toBe(null);
      expect(extractSymbolFromTitle(null)).toBe(null);
      expect(extractSymbolFromTitle('Lot Details:')).toBe(null);
      expect(extractSymbolFromTitle('Lot Details: - Apple Inc.')).toBe(null);
    });
  });

  describe('delay', () => {
    test('should return a promise that resolves after specified time', async () => {
      const start = Date.now();
      await delay(100);
      const end = Date.now();
      expect(end - start).toBeGreaterThanOrEqual(90);
      expect(end - start).toBeLessThan(200);
    });

    test('should handle zero delay', async () => {
      const start = Date.now();
      await delay(0);
      const end = Date.now();
      expect(end - start).toBeLessThan(50);
    });
  });

  describe('withRetry', () => {
    test('should succeed on first try', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const result = await withRetry(mockFn);
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('should retry on failure and eventually succeed', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('fail1'))
        .mockRejectedValueOnce(new Error('fail2'))
        .mockResolvedValue('success');
      
      const result = await withRetry(mockFn, 3);
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    test('should throw after max retries', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('always fails'));
      
      await expect(withRetry(mockFn, 2)).rejects.toThrow('always fails');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('log', () => {
    test('should log with prefix', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      log('test message');
      expect(consoleSpy).toHaveBeenCalledWith('[Tax Lot Extractor]', 'test message');
    });
  });
});