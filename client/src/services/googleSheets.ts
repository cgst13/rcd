import type { RCDReport, AccountCode, Signatory, RPTCollectionItem } from '../types/rcd';

// Service to handle Google Sheets interactions via Node.js Backend

export interface User {
  email: string;
  name: string;
  role: string;
}

// Configuration
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Helper to call Backend API
 */
const callApi = async (endpoint: string, method: string = 'GET', payload?: unknown) => {
  try {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (payload !== undefined) {
      options.body = JSON.stringify(payload);
    }

    const response = await fetch(`${API_URL}${endpoint}`, options);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    return null;
  }
};

/**
 * Submits an RCD report to the backend.
 */
export const submitRCDReport = async (report: RCDReport): Promise<boolean> => {
  console.log('Submitting Report Service:', report);

  const result = await callApi('/reports', 'POST', { report });
  
  if (result && result.result === 'success') {
    return true;
  }
  
  console.warn('Backend submission failed, saving to local storage as backup');
  
  // Fallback: Save to localStorage
  try {
    const existingReports = JSON.parse(localStorage.getItem('rcd_reports') || '[]');
    const newReports = [report, ...existingReports];
    localStorage.setItem('rcd_reports', JSON.stringify(newReports));
    return true; // Return true so UI doesn't break, but warn user ideally
  } catch (e) {
    console.error('Failed to save to localStorage', e);
    return false;
  }
};

/**
 * Retrieves recent reports from backend.
 */
export const getRecentReports = async (): Promise<RCDReport[]> => {
  const result = await callApi('/reports', 'GET');
  
  if (result && result.result === 'success') {
    return result.reports;
  }

  // Fallback: localStorage
  console.warn('Backend fetch failed, loading from local storage');
  try {
    return JSON.parse(localStorage.getItem('rcd_reports') || '[]');
  } catch {
    return [];
  }
};

/**
 * Logs in by checking credentials against the backend (which checks Google Sheets).
 */
export const loginWithGoogleSheet = async (email: string, password: string): Promise<User | null> => {
  console.log(`Attempting login for ${email}`);
  
  const result = await callApi('/login', 'POST', { email, password });
  
  if (result && result.result === 'success') {
    return {
      email: result.email,
      name: result.name,
      role: result.role
    };
  }

  return null;
};

/**
 * Account Code Management
 */

export const getAccountCodes = async (): Promise<AccountCode[]> => {
  const result = await callApi('/account-codes', 'GET');
  
  if (result && result.result === 'success') {
    return result.accountCodes;
  }

  // Fallback: LocalStorage
  const stored = localStorage.getItem('account_codes');
  if (stored) {
    return JSON.parse(stored);
  }
  
  // Default Mock Data (if nothing in storage and backend fails)
  return [
    { id: 1, mainCategory: 'General Fund', subCategory: 'Tax Revenue', code: '1-01-01-010' },
    { id: 2, mainCategory: 'General Fund', subCategory: 'Tax Revenue', code: '4-01-01-010' },
    { id: 3, mainCategory: 'Special Education Fund', subCategory: 'Tax Revenue', code: '4-01-01-020' },
    { id: 4, mainCategory: 'General Fund', subCategory: 'Business Income', code: '4-01-02-010' },
    { id: 5, mainCategory: 'General Fund', subCategory: 'Service Income', code: '4-01-03-010' },
    { id: 6, mainCategory: 'Trust Fund', subCategory: 'Inter-Agency', code: '2-02-01-010' },
  ];
};

export const saveAccountCode = async (code: AccountCode): Promise<boolean> => {
  const result = await callApi('/account-codes', 'POST', { accountCode: code });
  
  if (result && result.result === 'success') {
    return true;
  }

  // Fallback: LocalStorage
  console.warn('Backend save failed, saving to local storage');
  const currentCodes = await getAccountCodes();
  const index = currentCodes.findIndex(c => c.id === code.id);
  
  let newCodes;
  if (index >= 0) {
    newCodes = [...currentCodes];
    newCodes[index] = code;
  } else {
    newCodes = [...currentCodes, code];
  }
  
  localStorage.setItem('account_codes', JSON.stringify(newCodes));
  return true;
};

export const deleteAccountCode = async (id: number): Promise<boolean> => {
  const result = await callApi('/account-codes/delete', 'POST', { id });
  
  if (result && result.result === 'success') {
    return true;
  }

  // Fallback: LocalStorage
  console.warn('Backend delete failed, removing from local storage');
  const currentCodes = await getAccountCodes();
  const newCodes = currentCodes.filter(c => c.id !== id);
  localStorage.setItem('account_codes', JSON.stringify(newCodes));
  return true;
};

/**
 * Signatory Management
 */

export const getSignatories = async (): Promise<Signatory[]> => {
  const result = await callApi('/signatories', 'GET');
  
  if (result && result.result === 'success') {
    return result.signatories;
  }

  // Fallback: LocalStorage
  const stored = localStorage.getItem('signatories');
  if (stored) {
    return JSON.parse(stored);
  }
  
  // Default Mock Data
  return [
    { id: 1, fullName: 'CHRISTIAN S. TOLENTINO', position: 'RCC I', department: 'Treasury' },
    { id: 2, fullName: 'LEON F. PAZ, JR.', position: 'Chief, Accounting Department/Unit', department: 'Accounting' },
    { id: 3, fullName: 'SISTINE A. LINGON', position: 'Admin Aide IV', department: 'Treasury' },
    { id: 4, fullName: 'MENARD A. HERRERA', position: 'Municipal Treasurer', department: 'Treasury' },
  ];
};

export const saveSignatory = async (signatory: Signatory): Promise<boolean> => {
  const result = await callApi('/signatories', 'POST', { signatory });
  
  if (result && result.result === 'success') {
    return true;
  }

  // Fallback: LocalStorage
  console.warn('Backend save failed, saving to local storage');
  const currentSignatories = await getSignatories();
  const index = currentSignatories.findIndex(s => s.id === signatory.id);
  
  let newSignatories;
  if (index >= 0) {
    newSignatories = [...currentSignatories];
    newSignatories[index] = signatory;
  } else {
    newSignatories = [...currentSignatories, signatory];
  }
  
  localStorage.setItem('signatories', JSON.stringify(newSignatories));
  return true;
};

export const deleteSignatory = async (id: number): Promise<boolean> => {
  const result = await callApi('/signatories/delete', 'POST', { id });
  
  if (result && result.result === 'success') {
    return true;
  }

  // Fallback: LocalStorage
  console.warn('Backend delete failed, removing from local storage');
  const currentSignatories = await getSignatories();
  const newSignatories = currentSignatories.filter(s => s.id !== id);
  localStorage.setItem('signatories', JSON.stringify(newSignatories));
  return true;
};


export interface CollectionItem {
  id: number;
  afNo: string;
  orNo: string;
  payor: string;
  subCategory: string;
  mainCategory: string;
  accountCode: string;
  amount: number;
  date: string;
  remarks: string;
}

export const getCollectionEntries = async (): Promise<CollectionItem[]> => {
  const result = await callApi('/collections', 'GET');
  
  if (result && result.result === 'success') {
    return result.entries;
  }
  return [];
};

export const saveCollectionEntry = async (entry: CollectionItem): Promise<boolean> => {
  const result = await callApi('/collections', 'POST', { entry });
  
  if (result && result.result === 'success') {
    return true;
  }
  return false;
};

export interface CollectionHeader {
  afNo: string;
  orNo: string;
  payor: string;
  date: string;
  remarks: string;
}

export interface CollectionCharge {
  subCategory: string;
  mainCategory: string;
  accountCode: string;
  amount: number;
}

export const saveCollectionEntryBulk = async (
  header: CollectionHeader,
  charges: CollectionCharge[]
): Promise<boolean> => {
  const result = await callApi('/collections/bulk', 'POST', { header, charges });
  if (result && result.result === 'success') {
    return true;
  }
  return false;
};

export const updateCollectionEntry = async (entry: CollectionItem): Promise<boolean> => {
  const result = await callApi('/collections/update', 'POST', { entry });
  if (result && result.result === 'success') {
    return true;
  }
  return false;
};

export const deleteCollectionEntry = async (id: number): Promise<boolean> => {
  const result = await callApi('/collections/delete', 'POST', { id });
  if (result && result.result === 'success') {
    return true;
  }
  return false;
};

/**
 * RPT Collection Management
 */

export const getRPTCollections = async (): Promise<RPTCollectionItem[]> => {
  const result = await callApi('/rpt-collections', 'GET');
  
  if (result && result.result === 'success') {
    return result.collections;
  }

  // Fallback: LocalStorage
  const stored = localStorage.getItem('rpt_collections');
  if (stored) {
    return JSON.parse(stored);
  }
  
  return [];
};

export const saveRPTCollection = async (collection: RPTCollectionItem): Promise<boolean> => {
  const result = await callApi('/rpt-collections', 'POST', { collection });
  
  if (result && result.result === 'success') {
    return true;
  }

  // Fallback: LocalStorage
  console.warn('Backend save failed, saving to local storage');
  const currentCollections = await getRPTCollections();
  const index = currentCollections.findIndex(c => c.id === collection.id);
  
  let newCollections;
  if (index >= 0) {
    newCollections = [...currentCollections];
    newCollections[index] = collection;
  } else {
    newCollections = [...currentCollections, collection];
  }
  
  localStorage.setItem('rpt_collections', JSON.stringify(newCollections));
  return true;
};

export const deleteRPTCollection = async (id: number): Promise<boolean> => {
  const result = await callApi('/rpt-collections/delete', 'POST', { id });
  
  if (result && result.result === 'success') {
    return true;
  }

  // Fallback: LocalStorage
  console.warn('Backend delete failed, removing from local storage');
  const currentCollections = await getRPTCollections();
  const newCollections = currentCollections.filter(c => c.id !== id);
  localStorage.setItem('rpt_collections', JSON.stringify(newCollections));
  return true;
};
