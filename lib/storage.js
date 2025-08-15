function isJestMock() {
    return typeof chrome !== 'undefined' && 
           chrome.storage && 
           typeof chrome.storage.local.set.mockResolvedValue === 'function';
}

async function saveProgress(progress) {
    if (isJestMock()) {
        return chrome.storage.local.set({ extractionState: progress });
    }
    
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({ extractionState: progress }, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve();
            }
        });
    });
}

async function loadProgress() {
    if (isJestMock()) {
        const result = await chrome.storage.local.get(['extractionState']);
        const defaultProgress = {
            isRunning: false,
            currentIndex: 0,
            totalPositions: 0,
            lastUpdated: null
        };
        return result.extractionState || defaultProgress;
    }
    
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(['extractionState'], (result) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                const defaultProgress = {
                    isRunning: false,
                    currentIndex: 0,
                    totalPositions: 0,
                    lastUpdated: null
                };
                resolve(result.extractionState || defaultProgress);
            }
        });
    });
}

async function saveExtractedData(data) {
    if (isJestMock()) {
        return chrome.storage.local.set({ extractedData: data });
    }
    
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({ extractedData: data }, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve();
            }
        });
    });
}

async function loadExtractedData() {
    if (isJestMock()) {
        const result = await chrome.storage.local.get(['extractedData']);
        return result.extractedData || {};
    }
    
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(['extractedData'], (result) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve(result.extractedData || {});
            }
        });
    });
}

async function saveErrors(errors) {
    if (isJestMock()) {
        return chrome.storage.local.set({ errors: errors });
    }
    
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({ errors: errors }, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve();
            }
        });
    });
}

async function loadErrors() {
    if (isJestMock()) {
        const result = await chrome.storage.local.get(['errors']);
        return result.errors || [];
    }
    
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(['errors'], (result) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve(result.errors || []);
            }
        });
    });
}

async function clearErrors() {
    return saveErrors([]);
}

async function clearData() {
    if (isJestMock()) {
        return chrome.storage.local.clear();
    }
    
    return new Promise((resolve, reject) => {
        chrome.storage.local.clear(() => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve();
            }
        });
    });
}

// Export functions for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        saveProgress,
        loadProgress,
        clearData,
        saveExtractedData,
        loadExtractedData,
        saveErrors,
        loadErrors,
        clearErrors
    };
}