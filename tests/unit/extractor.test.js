const { 
  findNextStepButtons, 
  extractLotDetailsFromTable, 
  processLotDetails,
  createTaxLotEntry,
  getAccountIdFromElement,
  getSymbolFromRow
} = require('../../lib/extractor');

describe('Extractor Functions', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  describe('findNextStepButtons', () => {
    test('should find visible Next Steps buttons', () => {
      document.body.innerHTML = `
        <div>
          <sdps-button sdps-name="Next Steps" style="width: 100px; height: 30px;">Button 1</sdps-button>
          <sdps-button sdps-name="Next Steps" style="width: 100px; height: 30px;">Button 2</sdps-button>
          <sdps-button sdps-name="Other">Other Button</sdps-button>
        </div>
      `;

      const mockButton1 = { getBoundingClientRect: () => ({ width: 100, height: 30 }) };
      const mockButton2 = { getBoundingClientRect: () => ({ width: 100, height: 30 }) };
      
      document.querySelectorAll = jest.fn().mockReturnValue([mockButton1, mockButton2]);

      const buttons = findNextStepButtons();
      expect(buttons).toHaveLength(2);
      expect(document.querySelectorAll).toHaveBeenCalledWith('sdps-button[sdps-name="Next Steps"]');
    });

    test('should filter out hidden buttons', () => {
      const mockVisibleButton = { getBoundingClientRect: () => ({ width: 100, height: 30 }) };
      const mockHiddenButton = { getBoundingClientRect: () => ({ width: 0, height: 0 }) };
      
      document.querySelectorAll = jest.fn().mockReturnValue([mockVisibleButton, mockHiddenButton]);

      const buttons = findNextStepButtons();
      expect(buttons).toHaveLength(1);
    });

    test('should return empty array when no buttons found', () => {
      document.querySelectorAll = jest.fn().mockReturnValue([]);

      const buttons = findNextStepButtons();
      expect(buttons).toHaveLength(0);
    });
  });

  describe('extractLotDetailsFromTable', () => {
    test('should extract lot details from table rows', () => {
      const mockTable = {
        querySelectorAll: jest.fn().mockReturnValue([
          {
            querySelector: jest.fn()
              .mockReturnValueOnce({ textContent: '01/15/2023' }) // openDateCell
              .mockReturnValueOnce({ textContent: '100' }) // qtyCell
              .mockReturnValueOnce({ textContent: '$150.00' }) // priceCell
              .mockReturnValueOnce({ textContent: '$150.00' }) // cpsCell
              .mockReturnValueOnce({ textContent: '$15,000.00' }) // mktValCell
              .mockReturnValueOnce({ textContent: '$15,000.00' }) // costBasisCell
              .mockReturnValueOnce({ textContent: '$0.00' }) // gainLossCell
              .mockReturnValueOnce({ textContent: '0.00%' }) // gainLossPercentCell
              .mockReturnValueOnce({ textContent: 'Long' }) // holdPeriodCell
          }
        ])
      };

      document.getElementById = jest.fn().mockReturnValue(mockTable);

      const lots = extractLotDetailsFromTable();
      
      expect(lots).toHaveLength(1);
      expect(lots[0]).toEqual({
        open_date: '01/15/2023',
        quantity: 100,
        price: 150,
        cost_per_share: 150,
        market_value: 15000,
        cost_basis: 15000,
        gain_or_loss: 0,
        gain_or_loss_percentage: 0,
        holding_period: 'Long'
      });
    });

    test('should return null if table not found', () => {
      document.getElementById = jest.fn().mockReturnValue(null);

      const lots = extractLotDetailsFromTable();
      expect(lots).toBeNull();
    });

    test('should handle missing cells gracefully', () => {
      const mockTable = {
        querySelectorAll: jest.fn().mockReturnValue([
          {
            querySelector: jest.fn()
              .mockReturnValueOnce({ textContent: '01/15/2023' }) // openDateCell
              .mockReturnValueOnce({ textContent: '100' }) // qtyCell
              .mockReturnValueOnce({ textContent: '$150.00' }) // priceCell
              .mockReturnValueOnce(null) // cpsCell missing
              .mockReturnValueOnce(null) // mktValCell missing
              .mockReturnValueOnce(null) // costBasisCell missing
              .mockReturnValueOnce(null) // gainLossCell missing
              .mockReturnValueOnce(null) // gainLossPercentCell missing
              .mockReturnValueOnce(null) // holdPeriodCell missing
          }
        ])
      };

      document.getElementById = jest.fn().mockReturnValue(mockTable);

      const lots = extractLotDetailsFromTable();
      
      expect(lots).toHaveLength(1);
      expect(lots[0]).toEqual({
        open_date: '01/15/2023',
        quantity: 100,
        price: 150,
        cost_per_share: 0,
        market_value: 0,
        cost_basis: 0,
        gain_or_loss: 0,
        gain_or_loss_percentage: 0,
        holding_period: ''
      });
    });
  });

  describe('getAccountIdFromElement', () => {
    test('should extract account ID from element', () => {
      const mockElement = {
        closest: jest.fn().mockReturnValue({
          id: 'holdingsAccount_12345'
        })
      };

      const accountId = getAccountIdFromElement(mockElement);
      expect(accountId).toBe('holdingsAccount_12345');
    });

    test('should return fallback when account container not found', () => {
      const mockElement = {
        closest: jest.fn().mockReturnValue(null)
      };

      const accountId = getAccountIdFromElement(mockElement);
      expect(accountId).toBe('holdingsAccount_unknown');
    });
  });

  describe('getSymbolFromRow', () => {
    test('should extract symbol from row', () => {
      const mockElement = {
        closest: jest.fn().mockReturnValue({
          getAttribute: jest.fn().mockReturnValue('AAPL')
        })
      };

      const symbol = getSymbolFromRow(mockElement);
      expect(symbol).toBe('AAPL');
    });

    test('should return fallback when row not found', () => {
      const mockElement = {
        closest: jest.fn().mockReturnValue(null)
      };

      const symbol = getSymbolFromRow(mockElement);
      expect(symbol).toBe('unknown');
    });
  });

  describe('createTaxLotEntry', () => {
    test('should create properly structured tax lot entry', () => {
      const accountId = 'holdingsAccount_12345';
      const symbol = 'AAPL';
      const lots = [
        {
          open_date: '01/15/2023',
          quantity: 100,
          price: 150,
          cost_per_share: 150,
          market_value: 15000,
          cost_basis: 15000,
          gain_or_loss: 0,
          gain_or_loss_percentage: 0,
          holding_period: 'Long'
        }
      ];

      const taxLotData = {};
      createTaxLotEntry(taxLotData, accountId, symbol, lots);

      expect(taxLotData[accountId]).toBeDefined();
      expect(taxLotData[accountId]).toHaveLength(1);
      expect(taxLotData[accountId][0][symbol]).toEqual(lots);
    });

    test('should append to existing account data', () => {
      const taxLotData = {
        'holdingsAccount_12345': [
          { 'MSFT': [{ open_date: '01/01/2023', quantity: 50 }] }
        ]
      };

      const lots = [{ open_date: '01/15/2023', quantity: 100 }];
      createTaxLotEntry(taxLotData, 'holdingsAccount_12345', 'AAPL', lots);

      expect(taxLotData['holdingsAccount_12345']).toHaveLength(2);
      expect(taxLotData['holdingsAccount_12345'][1]['AAPL']).toEqual(lots);
    });

    test('should merge lots for existing symbol', () => {
      const taxLotData = {
        'holdingsAccount_12345': [
          { 'AAPL': [{ open_date: '01/01/2023', quantity: 50 }] }
        ]
      };

      const newLots = [{ open_date: '01/15/2023', quantity: 100 }];
      createTaxLotEntry(taxLotData, 'holdingsAccount_12345', 'AAPL', newLots);

      expect(taxLotData['holdingsAccount_12345']).toHaveLength(1);
      expect(taxLotData['holdingsAccount_12345'][0]['AAPL']).toHaveLength(2);
    });
  });
});