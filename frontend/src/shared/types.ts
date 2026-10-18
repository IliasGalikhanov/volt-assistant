export type Language = "ru" | "kk" | "en";
export type ModelMode = "primary" | "fallback" | "off";
export type Product = {
  read_only?: boolean;
  sku: string;
  name: string;
  names?: Record<string, string>;
  category: string;
  price_minor: number;
  currency: string;
  unit: string;
  step: number;
  stores: Record<string, number>;
  attributes: Record<string, string>;
  certificate?: string;
  source_url?: string;
  fetched_at: string;
};
export type Dataset = {
  id: string;
  name: string;
  kind: "synthetic" | "upload" | "ekt";
};
export type Selection = { sku: string; quantity: number; warehouse: string };
export type CartLine = Selection & {
  name: string;
  price_minor: number;
  currency: string;
  unit: string;
};
export type Cart = { revision: number; lines: CartLine[]; total_minor: number };
export type Proposal = {
  id: string;
  revision: number;
  lines: CartLine[];
  expires_at: string;
  total_minor: number;
};
export type Message = {
  role: "user" | "assistant";
  text: string;
  products?: Product[];
  mode?: string;
  warning?: string;
};
export type SpecRow = { query: string; quantity: number };
export type Job = {
  id: string;
  kind: string;
  status: string;
  name: string;
  error: string;
  result: { rows?: SpecRow[]; products?: Product[] };
  created_at: string;
};
export type ModelStatus = {
  available: boolean;
  models: string[] | null;
  primary: string;
  fallback: string;
  ekt_configured: boolean;
};
export type Alternative = {
  product: Product;
  matched: string[];
  differences: string[];
};
