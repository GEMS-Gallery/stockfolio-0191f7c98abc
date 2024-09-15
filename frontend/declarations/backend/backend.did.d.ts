import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface Holding {
  'purchasePrice' : number,
  'quantity' : number,
  'symbol' : string,
}
export interface _SERVICE {
  'addOrUpdateHolding' : ActorMethod<[string, number, number], undefined>,
  'getAllHoldings' : ActorMethod<[], Array<Holding>>,
  'getTotalPortfolioValue' : ActorMethod<[], number>,
  'init' : ActorMethod<[], undefined>,
  'removeHolding' : ActorMethod<[string], undefined>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
