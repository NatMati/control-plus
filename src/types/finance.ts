export type MovementType =
  | "INCOME"
  | "EXPENSE"
  | "TRANSFER"
  | "INVESTMENT_BUY"
  | "INVESTMENT_SELL"
  | "LOAN_OUT"
  | "LOAN_IN";

export type InstrumentType = "CRYPTO" | "STOCK" | "ETF" | "METAL" | null;

export type AccountRole =
  | "CHECKING"
  | "SAVINGS"
  | "INVESTMENT"
  | "CARD"
  | "CASH"
  | "LOAN";

export type MovementRow = {
  id: string;
  user_id: string;
  date: string;
  amount: number;
  type: MovementType;
  category: string | null;
  description: string | null;
  account_id: string | null;

  instrument_type: InstrumentType;
  ticker: string | null;

  counterparty: string | null;
  loan_id: string | null;
};

export type AccountRow = {
  id: string;
  name: string;
  role: AccountRole;
};
