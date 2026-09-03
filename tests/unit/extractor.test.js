const { 
  findNextStepButtons, 
  clickShowAllAccountsLink,
  collectAllPositionButtons,
  extractLotDetailsFromTable, 
  createTaxLotEntry,
  getAccountIdFromElement,
  getSymbolFromRow,
  getModalLotSymbol,
  fingerprintLots,
  waitForMatchingLotTable,
  triggerLotDetailsClick,
} = require('../../lib/extractor');

function lotModalHtml({ symbol, name, date, qty, price, holdingPeriod = 'Short Term' }) {
  return `
    <sdps-modal id="open-lot-overlay" class="sdps-modal--open">
      <div class="sdps-modal__overlay sdps-modal__overlay--open">
        <h2 id="open-lot-overlay-modal-title">Lot Details: ${symbol} - ${name}</h2>
        <input id="hdOverlayTitle" value="Lot Details: ${symbol} - ${name}">
        <table id="responsiveLotTable">
          <tbody class="holdings-no-border">
            <tr class="data-row">
              <th><span>${date}</span></th>
              <td name="Qty">${qty}</td>
              <td name="Price">${price}</td>
              <td name="CPS"><span>$10.00</span></td>
              <td name="MktVal"><span>$20.00</span></td>
              <td name="CostBasis"><span>$10.00</span></td>
              <td name="GainLoss"><span>+$10.00</span></td>
              <td name="GainLossPercent"><span>+100%</span></td>
              <td name="HoldPeriod"><span>${holdingPeriod}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </sdps-modal>
  `;
}

function useRealDomLookups() {
  document.getElementById = Document.prototype.getElementById.bind(document);
  document.querySelector = Document.prototype.querySelector.bind(document);
  document.querySelectorAll = Document.prototype.querySelectorAll.bind(document);
}

describe('Extractor Functions', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
    window.scrollTo = jest.fn();
  });

  describe('findNextStepButtons', () => {
    test('should find visible menu-trigger Next Steps buttons', () => {
      const mockButton1 = {
        getBoundingClientRect: () => ({ width: 100, height: 30 }),
      };
      const mockButton2 = {
        getBoundingClientRect: () => ({ width: 100, height: 30 }),
      };

      document.querySelectorAll = jest.fn((selector) => {
        if (selector === 'button[id^="menu-trigger-next-steps-"]') {
          return [mockButton1, mockButton2];
        }
        return [];
      });

      const buttons = findNextStepButtons();
      expect(buttons).toHaveLength(2);
    });

    test('falls back to the legacy Next Steps selector', () => {
      const legacyButton = { getBoundingClientRect: () => ({ width: 100, height: 30 }) };
      document.querySelectorAll = jest.fn((selector) => {
        if (selector === 'sdps-button[sdps-name="Next Steps"]') {
          return [legacyButton];
        }
        return [];
      });

      expect(findNextStepButtons()).toEqual([legacyButton]);
    });

    test('should filter out hidden buttons', () => {
      const mockVisibleButton = { getBoundingClientRect: () => ({ width: 100, height: 30 }) };
      const mockHiddenButton = { getBoundingClientRect: () => ({ width: 0, height: 0 }) };

      document.querySelectorAll = jest.fn((selector) => {
        if (selector === 'button[id^="menu-trigger-next-steps-"]') {
          return [mockVisibleButton, mockHiddenButton];
        }
        return [];
      });

      const buttons = findNextStepButtons();
      expect(buttons).toHaveLength(1);
    });

    test('should return empty array when no buttons found', () => {
      document.querySelectorAll = jest.fn().mockReturnValue([]);

      const buttons = findNextStepButtons();
      expect(buttons).toHaveLength(0);
    });
  });

  describe('clickShowAllAccountsLink', () => {
    test('clicks Show All Brokerage Accounts when present', () => {
      const click = jest.fn();
      document.querySelectorAll = jest.fn().mockReturnValue([{
        textContent: 'Show All Brokerage Accounts',
        closest: jest.fn().mockReturnValue({ click }),
      }]);

      expect(clickShowAllAccountsLink()).toBe(true);
      expect(click).toHaveBeenCalled();
    });
  });

  describe('collectAllPositionButtons', () => {
    test('deduplicates buttons discovered while scrolling', async () => {
      const button = {
        id: 'menu-trigger-next-steps-vt',
        getBoundingClientRect: () => ({ width: 10, height: 10 }),
      };

      document.querySelectorAll = jest.fn((selector) => {
        if (selector === 'a, button, span') {
          return [];
        }
        if (selector === 'button[id^="menu-trigger-next-steps-"]') {
          return [button];
        }
        return [];
      });

      const buttons = await collectAllPositionButtons({
        delayFn: async () => {},
        scrollSteps: 1,
        scrollDelayMs: 0,
        resetDelayMs: 0,
      });

      expect(buttons).toHaveLength(1);
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

    test('parses a Schwab lot row from live modal markup', () => {
      useRealDomLookups();
      document.body.innerHTML = lotModalHtml({
        symbol: 'VT',
        name: 'VANGUARD TOTAL WORLD STOCK INDEX FUND ETF SHARES',
        date: '07/24/2026',
        qty: ' 3.2368 ',
        price: ' $160.11 ',
        holdingPeriod: ' Short Term ',
      });

      const lots = extractLotDetailsFromTable();
      expect(lots).toHaveLength(1);
      expect(lots[0]).toMatchObject({
        open_date: '07/24/2026',
        quantity: 3.2368,
        price: 160.11,
        holding_period: 'Short Term',
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

  describe('getModalLotSymbol', () => {
    beforeEach(useRealDomLookups);

    test('reads the symbol from the open lot modal title', () => {
      document.body.innerHTML = lotModalHtml({
        symbol: 'VT',
        name: 'VANGUARD TOTAL WORLD',
        date: '07/24/2026',
        qty: '3.2368',
        price: '$160.11',
      });

      expect(getModalLotSymbol()).toBe('VT');
    });
  });

  describe('waitForMatchingLotTable', () => {
    beforeEach(useRealDomLookups);

    test('rejects leftover table data from the previous symbol', async () => {
      document.body.innerHTML = lotModalHtml({
        symbol: 'VT',
        name: 'VANGUARD TOTAL WORLD',
        date: '07/24/2026',
        qty: '3.2368',
        price: '$160.11',
      });
      const staleLots = extractLotDetailsFromTable();
      const staleFingerprint = fingerprintLots(staleLots);

      const result = await waitForMatchingLotTable('BND', staleFingerprint, {
        delayFn: async () => {},
        timeoutMs: 20,
        intervalMs: 5,
      });

      expect(result).toBeNull();
    });

    test('accepts a refreshed table even when the row ticker is unknown', async () => {
      document.body.innerHTML = lotModalHtml({
        symbol: 'BND',
        name: 'VANGUARD TOTAL BOND',
        date: '08/21/2026',
        qty: '6.9146',
        price: '$71.83',
      });
      const previousFingerprint = fingerprintLots([{
        open_date: '07/24/2026',
        quantity: 3.2368,
        price: 160.11,
      }]);

      const result = await waitForMatchingLotTable('unknown', previousFingerprint, {
        delayFn: async () => {},
        timeoutMs: 20,
        intervalMs: 5,
      });

      expect(result.modalSymbol).toBe('BND');
      expect(result.lots[0].price).toBe(71.83);
      expect(result.lots[0].open_date).toBe('08/21/2026');
    });
  });

  describe('triggerLotDetailsClick', () => {
    test('clicks a visible Lot Details menu item', () => {
      const click = jest.fn();
      document.querySelectorAll = jest.fn().mockReturnValue([{
        textContent: 'Lot Details',
        getBoundingClientRect: () => ({ width: 80, height: 20 }),
        closest: jest.fn().mockReturnValue({ click }),
      }]);

      expect(triggerLotDetailsClick()).toBe(true);
      expect(click).toHaveBeenCalled();
    });

    test('ignores hidden leftover Lot Details labels', () => {
      document.querySelectorAll = jest.fn().mockReturnValue([{
        textContent: 'Lot Details',
        getBoundingClientRect: () => ({ width: 0, height: 0 }),
        closest: jest.fn().mockReturnValue({ click: jest.fn() }),
      }]);

      expect(triggerLotDetailsClick()).toBe(false);
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
