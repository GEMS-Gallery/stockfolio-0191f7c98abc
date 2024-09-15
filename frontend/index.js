import { backend } from 'declarations/backend';

document.addEventListener('DOMContentLoaded', async () => {
    const holdingForm = document.getElementById('holdingForm');
    const holdingsTable = document.getElementById('holdingsTable').getElementsByTagName('tbody')[0];
    const portfolioValueSpan = document.getElementById('portfolioValue');

    // Function to refresh the holdings table
    async function refreshHoldings() {
        const holdings = await backend.getAllHoldings();
        holdingsTable.innerHTML = '';
        holdings.forEach(holding => {
            const row = holdingsTable.insertRow();
            row.insertCell(0).textContent = holding.symbol;
            row.insertCell(1).textContent = holding.quantity.toFixed(2);
            row.insertCell(2).textContent = '$' + holding.purchasePrice.toFixed(2);
            const actionCell = row.insertCell(3);
            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Delete';
            deleteButton.onclick = () => removeHolding(holding.symbol);
            actionCell.appendChild(deleteButton);
        });
        updatePortfolioValue();
    }

    // Function to update portfolio value
    async function updatePortfolioValue() {
        const value = await backend.getTotalPortfolioValue();
        portfolioValueSpan.textContent = value.toFixed(2);
    }

    // Function to add or update a holding
    async function addOrUpdateHolding(symbol, quantity, purchasePrice) {
        await backend.addOrUpdateHolding(symbol, parseFloat(quantity), parseFloat(purchasePrice));
        refreshHoldings();
    }

    // Function to remove a holding
    async function removeHolding(symbol) {
        await backend.removeHolding(symbol);
        refreshHoldings();
    }

    // Event listener for form submission
    holdingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const symbol = document.getElementById('symbol').value;
        const quantity = document.getElementById('quantity').value;
        const purchasePrice = document.getElementById('purchasePrice').value;
        await addOrUpdateHolding(symbol, quantity, purchasePrice);
        holdingForm.reset();
    });

    // Initial load of holdings
    refreshHoldings();
});