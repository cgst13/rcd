export interface RCDReport {
  id?: string;
  date: string;
  reportNumber: string;
  collectorName: string;
  fundType: 'General Fund' | 'Trust Fund' | 'SEF';
  collections: CollectionItem[];
  totalCollection: number;
  deposits: DepositItem[];
  totalDeposit: number;
  status: 'Draft' | 'Submitted' | 'Verified';
}

export interface CollectionItem {
  id: string;
  natureOfCollection: string; // e.g., "Business Tax", "Community Tax"
  accountCode?: string;
  amount: number;
}

export interface DepositItem {
  id: string;
  bank: string;
  referenceNumber: string; // OR/Validation number
  amount: number;
  date: string;
}

export const FUND_TYPES = ['General Fund', 'Trust Fund', 'SEF'] as const;

export const COLLECTION_TYPES = [
  'Community Tax',
  'Real Property Tax - Basic',
  'Real Property Tax - SEF',
  'Business Tax',
  'Fees and Charges',
  'Economic Enterprises',
  'Miscellaneous'
];

export interface AccountCode {
  id: number;
  mainCategory: string;
  subCategory: string;
  code: string;
}

export interface Signatory {
  id: number;
  fullName: string;
  position: string;
  department: string;
  remarks?: string;
}

export interface RPTCollectionItem {
  id: number;
  af56Id: string;
  orNumber: string;
  payor: string;
  barangay: string;
  landName: string;
  tdNumber: string;
  yearsPaid: string;
  amount: number;
  date: string;
  remarks?: string;
}
