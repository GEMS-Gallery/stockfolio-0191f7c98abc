import { Actor, HttpAgent } from "@dfinity/agent";
import { idlFactory } from "./declarations/backend/backend.did.js";

// Initialize Feather Icons
feather.replace();

let assets = [];
let backend;

const canisterId = process.env.CANISTER_ID_BACKEND;
const host = process.env.DFX_NETWORK === "local" ? "http://localhost:8000" : "https://ic0.app";

async function initializeBackend() {
  const agent = new HttpAgent({ host });
  backend = Actor.createActor(idlFactory, { agent, canisterId });
}

async function fetchAssets() {
  try {
    const response = await backend.http_request({
      method: "GET",
      url: "/api/assets",
      headers: [],
      body: new Uint8Array(),
    });
    if (response.status_code === 200) {
      assets = JSON.parse(new TextDecoder().decode(response.body));
      displayHoldings();
      updateCharts();
    } else {
      console.error('Error fetching assets:', response);
    }
  } catch (error) {
    console.error('Error fetching assets:', error);
  }
}

async function displayHoldings() {
  const holdingsBody = document.getElementById('holdings-body');
  holdingsBody.innerHTML = '';

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
    const response = await backend.http_request({
      method: "POST",
      url: "/api/assets",
      headers: [["Content-Type", "application/json"]],
      body: new TextEncoder().encode(JSON.stringify(asset)),
    });
    if (response.status_code === 201) {
      const newAsset = JSON.parse(new TextDecoder().decode(response.body));
      assets.push(newAsset);
      displayHoldings();
      updateCharts();
      closeAddAssetModal();
    } else {
      console.error('Error adding asset:', response);
    }
  } catch (error) {
    console.error('Error adding asset:', error);
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

document.addEventListener('DOMContentLoaded', async () => {
  await initializeBackend();
  showPage('holdings');
  await fetchAssets();

  document.getElementById('add-asset-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newAsset = {
      symbol: document.getElementById('symbol').value.toUpperCase(),
      name: document.getElementById('name').value,
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