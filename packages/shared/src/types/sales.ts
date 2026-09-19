import type { SALES_VISIT_KIND } from '../constants/index';

export type SalesVisitKind = (typeof SALES_VISIT_KIND)[keyof typeof SALES_VISIT_KIND];

export type SalesShop = {
  shopId: string;
  name: string;
  place: string;
};

export type SalesVisitInput = {
  shopId?: string | null;
  shopName: string;
  place: string;
  kind: SalesVisitKind;
  count: number;
  notes: string;
};

export type SalesReceivedInput = {
  shopId?: string | null;
  shopName: string;
  amount: number;
  gst: 'GST' | 'Non-GST';
  ref: string;
  mode: 'Cash' | 'Cheque' | 'UPI';
  bankName: string;
};

export type SalesDayPayload = {
  visits: SalesVisitInput[];
  received: SalesReceivedInput[];
  fuel: number;
};

export type SalesDayReport = {
  workDate: string;
  userId: string;
  salesmanName: string;
  instCount: number;
  instShops: string;
  demoCount: number;
  demoShops: string;
  received: number;
  recShops: string;
  gst: string;
  paymentRef: string;
  bankName: string;
  amounts: string;
  modes: string;
  cash: number;
  cheque: number;
  upi: number;
  issues: string;
  updates: string;
  visits: number;
  visitShops: string;
  fuel: number;
  fuelLocked: boolean;
  notebookBlocks: string;
};

export type SalesDashboard = {
  workDate: string;
  collectionMonth: string;
  collectionYear: number;
  totals: {
    inst: number;
    demos: number;
    visits: number;
    received: number;
    cash: number;
    cheque: number;
    upi: number;
    fuel: number;
    reports: number;
  };
  people: { id: string; name: string }[];
  rows: SalesDayReport[];
};

export type SalesPaymentRow = {
  shopId: string;
  shopName: string;
  place: string;
  amount: string;
  gst: string;
  status: string;
  paymentMode: string;
  date: string;
  reference: string;
  sheetRow: number;
  updatedBy: string | null;
  updatedByName: string | null;
  updatedAt: string | null;
};

export type SalesPaymentsView = {
  year: number;
  month: string;
  fileName: string;
  tabTitle: string;
  source: 'drive' | 'ledger';
  fullWorkbook: boolean;
  tabs: string[];
  statusOptions: string[];
  modeOptions: string[];
  rows: SalesPaymentRow[];
};
