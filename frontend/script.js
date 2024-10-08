import { Actor, HttpAgent } from "@dfinity/agent";
import { idlFactory } from "./declarations/backend/backend.did.js";
import { Principal } from "@dfinity/principal";

// Initialize Feather Icons
feather.replace();

let assets = [];
let backend;
let isInitialized = false;
let initializationAttempts = 0;
const MAX_INITIALIZATION_ATTEMPTS = 3;
const MAX_FETCH_ATTEMPTS = 3;

// Use a default canister ID if not set in environment variables
const canisterId = import.meta.env.VITE_CANISTER_ID_BACKEND || "rrkah-fqaaa-aaaaa-aaaaq-cai";
const host = import.meta.env.VITE_DFX_NETWORK === "local" ? "http://localhost:8000" : "https://ic0.app";

function isValidCanisterId(id) {
  try {
    Principal.fromText(id);
    return true;
  } catch {
    return false;
  }
}

async function initializeBackend() {
  if (!isValidCanisterId(canisterId)) {
    console.error("Invalid Canister ID:", canisterId);
    showError("Application configuration error. Please contact the administrator.");
    return false;
  }

  try {
    const agent = new HttpAgent({ host });
    backend = Actor.createActor(idlFactory, { agent, canisterId });
    console.log("Backend initialized successfully");
    isInitialized = true;
    return true;
  } catch (error) {
    console.error("Failed to initialize backend:", error);
    return false;
  }
}

async function retryInitialization() {
  while (initializationAttempts < MAX_INITIALIZATION_ATTEMPTS) {
    showLoading(`Initializing application... Attempt ${initializationAttempts + 1}/${MAX_INITIALIZATION_ATTEMPTS}`);
    const success = await initializeBackend();
    if (success) {
      hideLoading();
      return true;
    }
    initializationAttempts++;
    await new Promise(resolve => setTimeout(resolve, 2000 * initializationAttempts)); // Exponential backoff
  }
  hideLoading();
  showError("Failed to initialize the application. Please try again later or contact the administrator.");
  return false;
}

async function fetchAssetsWithRetry() {
  let attempts = 0;
  while (attempts < MAX_FETCH_ATTEMPTS) {
    try {
      if (backend && typeof backend.get_assets === 'function') {
        return await backend.get_assets();
      } else {
        // Fallback to external API if backend method is not available
        return await fetchAssetsFromExternalAPI();
      }
    } catch (error) {
      console.error(`Attempt ${attempts + 1} failed:`, error);
      attempts++;
      if (attempts >= MAX_FETCH_ATTEMPTS) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * attempts)); // Exponential backoff
    }
  }
}

async function fetchAssetsFromExternalAPI() {
  // This is a mock function. In a real application, you would call an actual financial data API.
  return [
    { symbol: 'AAPL', name: 'Apple Inc.', quantity: 10, assetType: 'Equity', purchasePrice: 150 },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', quantity: 5, assetType: 'Equity', purchasePrice: 2000 },
    { symbol: 'MSFT', name: 'Microsoft Corporation', quantity: 15, assetType: 'Equity', purchasePrice: 200 },
  ];
}

async function fetchAssets() {
  try {
    showLoading("Fetching assets...");
    assets = await fetchAssetsWithRetry();
    hideLoading();
    displayHoldings();
    updateCharts();
  } catch (error) {
    console.error('Error fetching assets:', error);
    hideLoading();
    showError("An error occurred while fetching assets. Please check your network connection and try again.");
  }
}

async function displayHoldings() {
  const holdingsBody = document.getElementById('holdings-body');
  holdingsBody.innerHTML = '';

  if (assets.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="7">No assets found. Add some assets to get started!</td>';
    holdingsBody.appendChild(row);
    return;
  }

  for (const asset of assets) {
    const marketData = await fetchMarketData(asset.symbol);
    const marketPrice = marketData.currentPrice;
    const marketValue = marketPrice * asset.quantity;
    const totalGainValue = marketValue - (asset.purchasePrice * asset.quantity);
    const totalGainPercent = ((marketPrice - asset.purchasePrice) / asset.purchasePrice) * 100;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td><span class="stock-symbol">${asset.symbol}</span> ${asset.name}</td>
      <td>${asset.quantity}</td>
      <td>$${marketValue.toFixed(2)}</td>
      <td>$${marketPrice.toFixed(2)}</td>
      <td>$${asset.purchasePrice.toFixed(2)}</td>
      <td class="${totalGainValue >= 0 ? 'positive' : 'negative'}">
        ${totalGainPercent >= 0 ? '+' : ''}${totalGainPercent.toFixed(2)}%<br>
        $${totalGainValue.toFixed(2)}
      </td>
      <td>${asset.assetType}</td>
    `;
    holdingsBody.appendChild(row);
  }
}

async function fetchMarketData(symbol) {
  try {
    const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    const currentPrice = data.chart.result[0].meta.regularMarketPrice;
    const previousClose = data.chart.result[0].meta.previousClose;
    return { currentPrice, previousClose };
  } catch (error) {
    console.error('Error fetching market data:', error);
    // Return mock data as fallback
    return {
      currentPrice: Math.random() * 1000,
      previousClose: Math.random() * 1000,
    };
  }
}

async function fetchCompanyInfo(symbol) {
  try {
    const response = await fetch(`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=price`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    const name = data.quoteSummary.result[0].price.longName;
    return { name };
  } catch (error) {
    console.error('Error fetching company info:', error);
    throw new Error('Company not found');
  }
}

function showPage(pageName) {
  const pages = document.querySelectorAll('#holdings-page, #allocations-page');
  const tabs = document.querySelectorAll('.tab');

  pages.forEach(page => {
    page.classList.remove('active');
    if (page.id === `${pageName}-page`) {
      page.classList.add('active');
    }
  });

  tabs.forEach(tab => {
    tab.classList.remove('active');
    if (tab.textContent.toLowerCase() === pageName) {
      tab.classList.add('active');
    }
  });

  if (pageName === 'allocations') {
    updateCharts();
  }
}

function showAddAssetModal() {
  const modal = document.getElementById('add-asset-modal');
  modal.style.display = 'block';
}

function closeAddAssetModal() {
  const modal = document.getElementById('add-asset-modal');
  modal.style.display = 'none';
  document.getElementById('add-asset-form').reset();
}

async function addAsset(asset) {
  try {
    showLoading("Adding asset...");
    if (backend && typeof backend.add_asset === 'function') {
      const newAsset = await backend.add_asset(asset);
      assets.push(newAsset);
    } else {
      // Fallback to local storage if backend method is not available
      assets.push(asset);
      localStorage.setItem('assets', JSON.stringify(assets));
    }
    hideLoading();
    displayHoldings();
    updateCharts();
    closeAddAssetModal();
    showSuccess("Asset added successfully!");
  } catch (error) {
    console.error('Error adding asset:', error);
    hideLoading();
    showError("An error occurred while adding the asset. Please try again.");
  }
}

async function updateCharts() {
  const assetTypes = {};
  const performanceData = [];

  for (const asset of assets) {
    if (!assetTypes[asset.assetType]) {
      assetTypes[asset.assetType] = 0;
    }
    const marketData = await fetchMarketData(asset.symbol);
    const marketValue = marketData.currentPrice * asset.quantity;
    assetTypes[asset.assetType] += marketValue;

    const totalGainValue = marketValue - (asset.purchasePrice * asset.quantity);
    performanceData.push({
      symbol: asset.symbol,
      performance: totalGainValue
    });
  }

  updateAllocationChart(assetTypes);
  updatePerformanceChart(performanceData);
}

function updateAllocationChart(assetTypes) {
  const ctx = document.getElementById('allocationChart').getContext('2d');
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(assetTypes),
      datasets: [{
        data: Object.values(assetTypes),
        backgroundColor: ['#2c3e50', '#34495e', '#7f8c8d', '#95a5a6', '#bdc3c7']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            font: {
              family: 'Inter',
              size: 12
            },
            boxWidth: 15
          }
        }
      }
    }
  });
}

function updatePerformanceChart(performanceData) {
  const ctx = document.getElementById('performanceChart').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: performanceData.map(d => d.symbol),
      datasets: [{
        label: 'Performance ($)',
        data: performanceData.map(d => d.performance),
        backgroundColor: performanceData.map(d => d.performance >= 0 ? 'rgba(76, 175, 80, 0.6)' : 'rgba(244, 67, 54, 0.6)'),
        borderColor: performanceData.map(d => d.performance >= 0 ? 'rgba(76, 175, 80, 1)' : 'rgba(244, 67, 54, 1)'),
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

function showError(message) {
  const errorElement = document.getElementById('error-message');
  errorElement.textContent = message;
  errorElement.style.display = 'block';
  setTimeout(() => {
    errorElement.style.display = 'none';
  }, 5000);
}

function showSuccess(message) {
  const successElement = document.getElementById('success-message');
  successElement.textContent = message;
  successElement.style.display = 'block';
  setTimeout(() => {
    successElement.style.display = 'none';
  }, 5000);
}

function showLoading(message = "Loading...") {
  const loadingElement = document.getElementById('loading');
  const loadingMessage = document.getElementById('loading-message');
  loadingMessage.textContent = message;
  loadingElement.style.display = 'flex';
}

function hideLoading() {
  const loadingElement = document.getElementById('loading');
  loadingElement.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', async () => {
  showLoading("Initializing application...");
  await retryInitialization();
  
  showPage('holdings');
  await fetchAssets();

  const symbolInput = document.getElementById('symbol');
  const nameInput = document.getElementById('name');
  const priceInput = document.getElementById('price');
  const purchasePriceInput = document.getElementById('purchasePrice');

  symbolInput.addEventListener('input', async () => {
    const symbol = symbolInput.value.toUpperCase().trim();
    if (symbol.length >= 1) {
      try {
        const [marketData, companyInfo] = await Promise.all([
          fetchMarketData(symbol),
          fetchCompanyInfo(symbol)
        ]);
        if (marketData && companyInfo) {
          nameInput.value = companyInfo.name;
          priceInput.value = marketData.currentPrice.toFixed(2);
          purchasePriceInput.value = marketData.currentPrice.toFixed(2); // Set purchase price to current price by default
        } else {
          nameInput.value = '';
          priceInput.value = '';
          purchasePriceInput.value = '';
        }
      } catch (error) {
        console.error('Error fetching stock data:', error);
        showError("Unable to fetch stock data. Please try again.");
      }
    }
  });

  document.getElementById('add-asset-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newAsset = {
      symbol: symbolInput.value.toUpperCase(),
      name: nameInput.value,
      quantity: parseFloat(document.getElementById('quantity').value),
      assetType: document.getElementById('type').value,
      purchasePrice: parseFloat(purchasePriceInput.value)
    };
    await addAsset(newAsset);
  });

  window.onclick = function(event) {
    const modal = document.getElementById('add-asset-modal');
    if (event.target == modal) {
      closeAddAssetModal();
    }
  };
});

// Expose functions to window object for use in HTML
window.showAddAssetModal = showAddAssetModal;
window.closeAddAssetModal = closeAddAssetModal;
window.showPage = showPage;