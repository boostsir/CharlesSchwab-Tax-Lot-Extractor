const { 
  convertToCSV, 
  formatJSONExport, 
  downloadFile,
  createCSVHeaders,
  formatLotForCSV 
} = require('../../lib/exporter');

describe('Exporter Functions', () => {
  const mockTaxLotData = {
    'holdingsAccount_123': [
      {
        'AAPL': [
          {
            open_date: '01/15/2023',
            quantity: 100,
            price: 150.00,
            cost_per_share: 150.00,
            market_value: 15000.00,
            cost_basis: 15000.00,
            gain_or_loss: 0.00,
            gain_or_loss_percentage: 0.00,
            holding_period: 'Long'
          },
          {
            open_date: '02/01/2023',
            quantity: 50,
            price: 160.00,
            cost_per_share: 160.00,
            market_value: 8000.00,
            cost_basis: 8000.00,
            gain_or_loss: 0.00,
            gain_or_loss_percentage: 0.00,
            holding_period: 'Short'
          }
        ]
      },
      {
        'MSFT': [
          {
            open_date: '03/10/2023',
            quantity: 75,
            price: 200.00,
            cost_per_share: 200.00,
            market_value: 15000.00,
            cost_basis: 15000.00,
            gain_or_loss: 500.00,
            gain_or_loss_percentage: 3.33,
            holding_period: 'Long'
          }
        ]
      }
    ],
    'holdingsAccount_456': [
      {
        'TSLA': [
          {
            open_date: '04/05/2023',
            quantity: 25,
            price: 800.00,
            cost_per_share: 800.00,
            market_value: 20000.00,
            cost_basis: 20000.00,
            gain_or_loss: -1000.00,
            gain_or_loss_percentage: -5.00,
            holding_period: 'Short'
          }
        ]
      }
    ]
  };

  describe('createCSVHeaders', () => {
    test('should return correct CSV headers', () => {
      const headers = createCSVHeaders();
      expect(headers).toEqual([
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
      ]);
    });
  });

  describe('formatLotForCSV', () => {
    test('should format lot data for CSV row', () => {
      const lot = {
        open_date: '01/15/2023',
        quantity: 100,
        price: 150.00,
        cost_per_share: 150.00,
        market_value: 15000.00,
        cost_basis: 15000.00,
        gain_or_loss: 500.00,
        gain_or_loss_percentage: 3.33,
        holding_period: 'Long'
      };

      const result = formatLotForCSV('holdingsAccount_123', 'AAPL', lot);
      expect(result).toEqual([
        'holdingsAccount_123',
        'AAPL',
        '01/15/2023',
        100,
        150.00,
        150.00,
        15000.00,
        15000.00,
        500.00,
        3.33,
        'Long'
      ]);
    });

    test('should handle missing fields gracefully', () => {
      const lot = {
        open_date: '01/15/2023',
        quantity: 100,
        price: 150.00
        // Missing other fields
      };

      const result = formatLotForCSV('holdingsAccount_123', 'AAPL', lot);
      expect(result).toEqual([
        'holdingsAccount_123',
        'AAPL',
        '01/15/2023',
        100,
        150.00,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined
      ]);
    });
  });

  describe('convertToCSV', () => {
    test('should convert tax lot data to CSV format', () => {
      const csv = convertToCSV(mockTaxLotData);
      const lines = csv.split('\n');
      
      // Check header
      expect(lines[0]).toBe('Account ID,Symbol,Open Date,Quantity,Price,Cost Per Share,Market Value,Cost Basis,Gain/Loss ($),Gain/Loss (%),Holding Period');
      
      // Check first data row (AAPL first lot)
      expect(lines[1]).toBe('holdingsAccount_123,AAPL,01/15/2023,100,150,150,15000,15000,0,0,Long');
      
      // Check that we have the right number of rows (header + 4 lots)
      expect(lines).toHaveLength(5);
    });

    test('should handle empty data', () => {
      const csv = convertToCSV({});
      const lines = csv.split('\n');
      
      // Should only have header
      expect(lines).toHaveLength(1);
      expect(lines[0]).toBe('Account ID,Symbol,Open Date,Quantity,Price,Cost Per Share,Market Value,Cost Basis,Gain/Loss ($),Gain/Loss (%),Holding Period');
    });

    test('should escape commas in data fields', () => {
      const dataWithCommas = {
        'holdingsAccount_123': [
          {
            'TEST,SYMBOL': [
              {
                open_date: '01/15/2023',
                quantity: 100,
                price: 150.00,
                cost_per_share: 150.00,
                market_value: 15000.00,
                cost_basis: 15000.00,
                gain_or_loss: 0.00,
                gain_or_loss_percentage: 0.00,
                holding_period: 'Long,Term'
              }
            ]
          }
        ]
      };

      const csv = convertToCSV(dataWithCommas);
      const lines = csv.split('\n');
      
      // Should quote fields with commas
      expect(lines[1]).toContain('"TEST,SYMBOL"');
      expect(lines[1]).toContain('"Long,Term"');
    });
  });

  describe('formatJSONExport', () => {
    test('should format JSON with proper indentation', () => {
      const result = formatJSONExport(mockTaxLotData);
      
      expect(typeof result).toBe('string');
      expect(result).toContain('holdingsAccount_123');
      expect(result).toContain('AAPL');
      expect(result).toContain('MSFT');
      expect(result).toContain('TSLA');
      
      // Should be properly formatted JSON
      expect(() => JSON.parse(result)).not.toThrow();
    });

    test('should handle empty data', () => {
      const result = formatJSONExport({});
      expect(result).toBe('{}');
    });
  });

  describe('downloadFile', () => {
    beforeEach(() => {
      // Mock DOM elements
      const mockElement = {
        href: '',
        download: '',
        click: jest.fn()
      };
      
      global.document.createElement = jest.fn(() => mockElement);
      global.document.body.appendChild = jest.fn();
      global.document.body.removeChild = jest.fn();
    });

    test('should create and trigger download for JSON', () => {
      const mockElement = {
        href: '',
        download: '',
        click: jest.fn()
      };
      
      global.document.createElement.mockReturnValue(mockElement);

      downloadFile(mockTaxLotData, 'json');

      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(mockElement.download).toBe('schwab-tax-lots.json');
      expect(mockElement.click).toHaveBeenCalled();
    });

    test('should create and trigger download for CSV', () => {
      const mockElement = {
        href: '',
        download: '',
        click: jest.fn()
      };
      
      global.document.createElement.mockReturnValue(mockElement);

      downloadFile(mockTaxLotData, 'csv');

      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(mockElement.download).toBe('schwab-tax-lots.csv');
      expect(mockElement.click).toHaveBeenCalled();
    });

    test('should throw error for unsupported format', () => {
      expect(() => {
        downloadFile(mockTaxLotData, 'xml');
      }).toThrow('Unsupported export format: xml');
    });
  });
});