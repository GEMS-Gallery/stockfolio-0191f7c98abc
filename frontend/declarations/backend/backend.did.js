export const idlFactory = ({ IDL }) => {
  const Holding = IDL.Record({
    'purchasePrice' : IDL.Float64,
    'quantity' : IDL.Float64,
    'symbol' : IDL.Text,
  });
  return IDL.Service({
    'addOrUpdateHolding' : IDL.Func(
        [IDL.Text, IDL.Float64, IDL.Float64],
        [],
        [],
      ),
    'getAllHoldings' : IDL.Func([], [IDL.Vec(Holding)], ['query']),
    'getTotalPortfolioValue' : IDL.Func([], [IDL.Float64], ['query']),
    'init' : IDL.Func([], [], []),
    'removeHolding' : IDL.Func([IDL.Text], [], []),
  });
};
export const init = ({ IDL }) => { return []; };
