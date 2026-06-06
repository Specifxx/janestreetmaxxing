// Curated screening universes for the two markets the user trades on Stake:
// US (NYSE/Nasdaq) and Australia (ASX, ".AX" suffix on Yahoo). Kept to liquid,
// optionable large/mid-caps so the ODTE expected-move maths is meaningful and
// to stay within Yahoo rate limits during a sweep.

export interface UniverseItem {
  symbol: string;
  name: string;
}

export const US_UNIVERSE: UniverseItem[] = [
  { symbol: "AAPL", name: "Apple" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "NVDA", name: "NVIDIA" },
  { symbol: "AMZN", name: "Amazon" },
  { symbol: "GOOGL", name: "Alphabet" },
  { symbol: "META", name: "Meta Platforms" },
  { symbol: "TSLA", name: "Tesla" },
  { symbol: "AMD", name: "Advanced Micro Devices" },
  { symbol: "AVGO", name: "Broadcom" },
  { symbol: "NFLX", name: "Netflix" },
  { symbol: "CRM", name: "Salesforce" },
  { symbol: "ORCL", name: "Oracle" },
  { symbol: "ADBE", name: "Adobe" },
  { symbol: "PLTR", name: "Palantir" },
  { symbol: "JPM", name: "JPMorgan Chase" },
  { symbol: "BAC", name: "Bank of America" },
  { symbol: "V", name: "Visa" },
  { symbol: "MA", name: "Mastercard" },
  { symbol: "DIS", name: "Walt Disney" },
  { symbol: "KO", name: "Coca-Cola" },
  { symbol: "PEP", name: "PepsiCo" },
  { symbol: "WMT", name: "Walmart" },
  { symbol: "COST", name: "Costco" },
  { symbol: "MCD", name: "McDonald's" },
  { symbol: "NKE", name: "Nike" },
  { symbol: "XOM", name: "Exxon Mobil" },
  { symbol: "CVX", name: "Chevron" },
  { symbol: "UNH", name: "UnitedHealth" },
  { symbol: "JNJ", name: "Johnson & Johnson" },
  { symbol: "PFE", name: "Pfizer" },
  { symbol: "LLY", name: "Eli Lilly" },
  { symbol: "INTC", name: "Intel" },
  { symbol: "MU", name: "Micron" },
  { symbol: "QCOM", name: "Qualcomm" },
  { symbol: "BA", name: "Boeing" },
  { symbol: "CAT", name: "Caterpillar" },
  { symbol: "GE", name: "GE Aerospace" },
  { symbol: "UBER", name: "Uber" },
  { symbol: "COIN", name: "Coinbase" },
  { symbol: "SOFI", name: "SoFi Technologies" },
];

export const AU_UNIVERSE: UniverseItem[] = [
  { symbol: "BHP.AX", name: "BHP Group" },
  { symbol: "RIO.AX", name: "Rio Tinto" },
  { symbol: "CBA.AX", name: "Commonwealth Bank" },
  { symbol: "NAB.AX", name: "National Australia Bank" },
  { symbol: "WBC.AX", name: "Westpac" },
  { symbol: "ANZ.AX", name: "ANZ Group" },
  { symbol: "MQG.AX", name: "Macquarie Group" },
  { symbol: "CSL.AX", name: "CSL Limited" },
  { symbol: "WES.AX", name: "Wesfarmers" },
  { symbol: "WOW.AX", name: "Woolworths" },
  { symbol: "COL.AX", name: "Coles Group" },
  { symbol: "TLS.AX", name: "Telstra" },
  { symbol: "WDS.AX", name: "Woodside Energy" },
  { symbol: "FMG.AX", name: "Fortescue" },
  { symbol: "GMG.AX", name: "Goodman Group" },
  { symbol: "TCL.AX", name: "Transurban" },
  { symbol: "WTC.AX", name: "WiseTech Global" },
  { symbol: "XRO.AX", name: "Xero" },
  { symbol: "ALL.AX", name: "Aristocrat Leisure" },
  { symbol: "QAN.AX", name: "Qantas Airways" },
  { symbol: "STO.AX", name: "Santos" },
  { symbol: "REA.AX", name: "REA Group" },
  { symbol: "COH.AX", name: "Cochlear" },
  { symbol: "JBH.AX", name: "JB Hi-Fi" },
  { symbol: "PLS.AX", name: "Pilbara Minerals" },
  { symbol: "MIN.AX", name: "Mineral Resources" },
  { symbol: "NST.AX", name: "Northern Star Resources" },
  { symbol: "ALD.AX", name: "Ampol" },
  { symbol: "APT.AX", name: "Block (Afterpay)" },
  { symbol: "ZIP.AX", name: "Zip Co" },
];

export function universeFor(market: "us" | "au" | "all"): UniverseItem[] {
  if (market === "us") return US_UNIVERSE;
  if (market === "au") return AU_UNIVERSE;
  return [...US_UNIVERSE, ...AU_UNIVERSE];
}
