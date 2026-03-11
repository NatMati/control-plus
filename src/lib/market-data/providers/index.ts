// src/lib/market-data/providers/index.ts
import type { AssetClass, MarketProvider } from "../types";
import { CoinGeckoProvider } from "./coingecko";
import { YahooProvider } from "./yahoo";

export function providerForAssetClass(assetClass: AssetClass): MarketProvider {
  return assetClass === "CRYPTO" ? CoinGeckoProvider : YahooProvider;
}

export { CoinGeckoProvider, YahooProvider };
