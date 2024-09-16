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
      const response = await backend.http_request({
        method: "GET",
        url: "/api/assets",
        headers: [],
        body: new Uint8Array(),
      });
      if (response.status_code === 200) {
        return JSON.parse(new TextDecoder().decode(response.body));
      } else {
        throw new Error(`HTTP error! status: ${response.status_code}`);
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

async function fetchAssets() {
  if (!isInitialized) {
    console.error("Backend is not initialized. Unable to fetch assets.");
    showError("Unable to fetch assets. Please try again later.");
    return;
  }

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
    row.innerHTML = '<td colspan="6">No assets found. Add some assets to get started!</td>';
    holdingsBody.appendChild(row);
    return;
  }

  for (const asset of assets) {
    const marketData = await fetchMarketData(asset.symbol);
    const marketPrice = marketData.currentPrice;
    const previousClose = marketData.previousClose;
    const marketValue = marketPrice * asset.quantity;
    const totalGainValue = marketValue - (previousClose * asset.quantity);
    const totalGainPercent = (totalGainValue / (previousClose * asset.quantity)) * 100;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td><span class="stock-symbol">${asset.symbol}</span> ${asset.name}</td>
      <td>${asset.quantity}</td>
      <td>$${marketValue.toFixed(2)}</td>
      <td>$${marketPrice.toFixed(2)}</td>
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
  // This is a mock function. In a real application, you would call an actual market data API.
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        currentPrice: Math.random() * 1000,
        previousClose: Math.random() * 1000,
      });
    }, 100);
  });
}

async function fetchCompanyInfo(symbol) {
  // This is a mock function. In a real application, you would call an actual financial data API.
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const mockCompanies = {
        'AAPL': 'Apple Inc.',
        'GOOGL': 'Alphabet Inc.',
        'MSFT': 'Microsoft Corporation',
        'AMZN': 'Amazon.com, Inc.',
        'FB': 'Facebook, Inc.'
      };
      if (mockCompanies[symbol]) {
        resolve({ name: mockCompanies[symbol] });
      } else {
        reject(new Error('Company not found'));
      }
    }, 500);
  });
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
  if (!isInitialized) {
    showError("The application is not fully initialized. Please try again later.");
    return;
  }
  const modal = document.getElementById('add-asset-modal');
  modal.style.display = 'block';
}

function closeAddAssetModal() {
  const modal = document.getElementById('add-asset-modal');
  modal.style.display = 'none';
  document.getElementById('add-asset-form').reset();
}

async function addAsset(asset) {
  if (!isInitialized) {
    console.error("Backend is not initialized. Unable to add asset.");
    showError("Unable to add asset. Please try again later.");
    return;
  }

  try {
    showLoading("Adding asset...");
    const response = await backend.http_request({
      method: "POST",
      url: "/api/assets",
      headers: [["Content-Type", "application/json"]],
      body: new TextEncoder().encode(JSON.stringify(asset)),
    });
    hideLoading();
    if (response.status_code === 201) {
      const newAsset = JSON.parse(new TextDecoder().decode(response.body));
      assets.push(newAsset);
      displayHoldings();
      updateCharts();
      closeAddAssetModal();
      showSuccess("Asset added successfully!");
    } else {
      console.error('Error adding asset:', response);
      showError("Failed to add asset. Please try again.");
    }
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

    const previousClose = marketData.previousClose;
    const totalGainValue = marketValue - (previousClose * asset.quantity);
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
  const initialized = await retryInitialization();
  
  if (initialized) {
    showPage('holdings');
    await fetchAssets();
  } else {
    showError("Failed to initialize the application. Please try again later or contact the administrator.");
  }

  const symbolInput = document.getElementById('symbol');
  const nameInput = document.getElementById('name');

  symbolInput.addEventListener('blur', async () => {
    const symbol = symbolInput.value.toUpperCase();
    if (symbol) {
      try {
        const companyInfo = await fetchCompanyInfo(symbol);
        nameInput.value = companyInfo.name;
      } catch (error) {
        console.error('Error fetching company info:', error);
        showError("Unable to fetch company name. Please enter it manually.");
      }
    }
  });

  document.getElementById('add-asset-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isInitialized) {
      showError("The application is not fully initialized. Please try again later.");
      return;
    }
    const newAsset = {
      symbol: symbolInput.value.toUpperCase(),
      name: nameInput.value,
      quantity: parseFloat(document.getElementById('quantity').value),
      assetType: document.getElementById('type').value
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