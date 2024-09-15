import Hash "mo:base/Hash";

import Array "mo:base/Array";
import Float "mo:base/Float";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Text "mo:base/Text";

actor StockHolding {
    // Define the structure for a stock holding
    public type Holding = {
        symbol: Text;
        quantity: Float;
        purchasePrice: Float;
    };

    // Use a stable variable to store holdings
    private stable var holdingsEntries : [(Text, Holding)] = [];
    private var holdings = HashMap.HashMap<Text, Holding>(10, Text.equal, Text.hash);

    // Initialize holdings from stable storage
    private func loadHoldings() {
        for ((k, v) in holdingsEntries.vals()) {
            holdings.put(k, v);
        };
    };

    // Constructor
    public func init() : async () {
        loadHoldings();
    };

    // Add or update a stock holding
    public func addOrUpdateHolding(symbol: Text, quantity: Float, purchasePrice: Float) : async () {
        let holding : Holding = {
            symbol = symbol;
            quantity = quantity;
            purchasePrice = purchasePrice;
        };
        holdings.put(symbol, holding);
    };

    // Remove a stock holding
    public func removeHolding(symbol: Text) : async () {
        holdings.delete(symbol);
    };

    // Get all stock holdings
    public query func getAllHoldings() : async [Holding] {
        return Iter.toArray(holdings.vals());
    };

    // Mock function to get current stock price (in real-world, this would call an external API)
    private func getCurrentPrice(symbol: Text) : Float {
        // Mock prices for demonstration
        switch (symbol) {
            case "AAPL" { 150.0 };
            case "GOOGL" { 2800.0 };
            case "MSFT" { 300.0 };
            case _ { 100.0 }; // Default price for unknown symbols
        }
    };

    // Calculate total portfolio value
    public query func getTotalPortfolioValue() : async Float {
        var totalValue : Float = 0;
        for (holding in holdings.vals()) {
            let currentPrice = getCurrentPrice(holding.symbol);
            totalValue += holding.quantity * currentPrice;
        };
        return totalValue;
    };

    // System functions for upgrades
    system func preupgrade() {
        holdingsEntries := Iter.toArray(holdings.entries());
    };

    system func postupgrade() {
        loadHoldings();
    };
}