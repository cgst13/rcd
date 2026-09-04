export interface RCDReport {
  id?: string;
  date: string;
  reportNumber: string;
  collectorName: string;
  collectorEmail?: string;
  userId?: string;
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
  collectorEmail?: string;
  userId?: string;
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
  parcel?: string;
  collectorEmail?: string;
  userId?: string;
}

export interface CommunityTaxItem {
  id: number;
  afNo: string;           // "BRF 0016" or "0016"
  bookletNo?: string;     // Booklet Number (e.g. "01", "B-01")
  ctcNo: string;          // CTC Certificate / OR Number
  taxpayerName: string;   // Full name of Individual or Corporate entity
  ctcType: 'Individual' | 'Corporation';
  gender?: 'Male' | 'Female';
  basicSalary?: number;
  barangay: string;
  address?: string;
  basicTax: number;       // ₱5.00 (Individual) or ₱500.00 (Corporation)
  additionalTax: number;  // Gross receipts / property / earnings
  penalty?: number;       // Delinquency penalty / surcharge
  amount: number;         // Total = basic + additional + penalty
  date: string;           // Date of Issue (YYYY-MM-DD)
  remarks?: string;
  collectorEmail?: string;
  userId?: string;
}

