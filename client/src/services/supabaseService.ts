import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { RCDReport, AccountCode, Signatory, RPTCollectionItem } from '../types/rcd';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
}

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

// ============================================================================
// 1. RCD REPORTS (Table: rcd_reports)
// ============================================================================

export const submitRCDReport = async (report: RCDReport): Promise<boolean> => {
  if (isSupabaseConfigured()) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('rcd_reports')
        .insert({
          user_id: user.id,
          report_number: report.reportNumber,
          date: report.date || new Date().toISOString().split('T')[0],
          collector_name: report.collectorName || user.user_metadata?.full_name || user.email,
          fund_type: report.fundType,
          collections: report.collections,
          total_collection: report.totalCollection,
          deposits: report.deposits,
          total_deposit: report.totalDeposit,
          status: report.status || 'Submitted',
        });

      if (error) {
        console.error('Supabase submit report error:', error);
        throw error;
      }
      return true;
    } catch (e) {
      console.error('Error submitting report to Supabase, falling back to local storage:', e);
    }
  }

  // Fallback to localStorage
  try {
    const existingReports = JSON.parse(localStorage.getItem('rcd_reports') || '[]');
    const newReports = [report, ...existingReports];
    localStorage.setItem('rcd_reports', JSON.stringify(newReports));
    return true;
  } catch (e) {
    console.error('Failed to save to localStorage', e);
    return false;
  }
};

export const getRecentReports = async (): Promise<RCDReport[]> => {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('rcd_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        return data.map((row: any) => ({
          id: row.id,
          date: row.date,
          reportNumber: row.report_number,
          collectorName: row.collector_name,
          fundType: row.fund_type,
          collections: row.collections || [],
          totalCollection: parseFloat(row.total_collection || 0),
          deposits: row.deposits || [],
          totalDeposit: parseFloat(row.total_deposit || 0),
          status: row.status,
        }));
      }
    } catch (e) {
      console.warn('Error fetching reports from Supabase, checking local storage:', e);
    }
  }

  try {
    return JSON.parse(localStorage.getItem('rcd_reports') || '[]');
  } catch {
    return [];
  }
};

export const deleteReport = async (id: string): Promise<boolean> => {
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from('rcd_reports')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (e) {
      console.error('Error deleting report from Supabase:', e);
    }
  }

  try {
    const existing = JSON.parse(localStorage.getItem('rcd_reports') || '[]');
    const filtered = existing.filter((r: RCDReport) => r.id !== id && r.reportNumber !== id);
    localStorage.setItem('rcd_reports', JSON.stringify(filtered));
    return true;
  } catch {
    return false;
  }
};

// ============================================================================
// 2. ACCOUNT CODES (Table: rcd_account_codes)
// ============================================================================

export const getAccountCodes = async (): Promise<AccountCode[]> => {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('rcd_account_codes')
        .select('*')
        .order('id', { ascending: true });

      if (!error && data) {
        return data.map((row: any) => ({
          id: row.id,
          mainCategory: row.main_category,
          subCategory: row.sub_category,
          code: row.code,
        }));
      }
    } catch (e) {
      console.warn('Error fetching account codes from Supabase:', e);
    }
  }

  const stored = localStorage.getItem('account_codes');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {}
  }

  return [];
};

export const saveAccountCode = async (code: AccountCode): Promise<boolean> => {
  if (isSupabaseConfigured()) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (code.id && code.id > 0) {
        // Try to update existing
        const { error } = await supabase
          .from('rcd_account_codes')
          .update({
            main_category: code.mainCategory,
            sub_category: code.subCategory,
            code: code.code,
          })
          .eq('id', code.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('rcd_account_codes')
          .insert({
            user_id: user.id,
            main_category: code.mainCategory,
            sub_category: code.subCategory,
            code: code.code,
          });
        if (error) throw error;
      }
      return true;
    } catch (e) {
      console.error('Error saving account code in Supabase:', e);
    }
  }

  // Fallback
  const currentCodes = await getAccountCodes();
  const index = currentCodes.findIndex(c => c.id === code.id);
  let newCodes;
  if (index >= 0) {
    newCodes = [...currentCodes];
    newCodes[index] = code;
  } else {
    const nextId = currentCodes.length > 0 ? Math.max(...currentCodes.map(c => c.id)) + 1 : 1;
    newCodes = [...currentCodes, { ...code, id: code.id || nextId }];
  }
  localStorage.setItem('account_codes', JSON.stringify(newCodes));
  return true;
};

export const deleteAccountCode = async (id: number): Promise<boolean> => {
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from('rcd_account_codes')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return true;
    } catch (e) {
      console.error('Error deleting account code from Supabase:', e);
    }
  }

  const currentCodes = await getAccountCodes();
  const newCodes = currentCodes.filter(c => c.id !== id);
  localStorage.setItem('account_codes', JSON.stringify(newCodes));
  return true;
};

export const importAccountCodes = async (
  codes: { mainCategory: string; subCategory: string; code: string }[],
  replaceExisting: boolean = false
): Promise<{ success: boolean; count: number }> => {
  if (!codes || codes.length === 0) return { success: false, count: 0 };

  if (isSupabaseConfigured()) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || null;

      if (replaceExisting) {
        // Delete all existing codes
        await supabase.from('rcd_account_codes').delete().neq('id', 0);
      }

      // Format payload for batch insert
      const rowsToInsert = codes.map(c => ({
        user_id: userId,
        main_category: c.mainCategory.trim() || 'General Revenue',
        sub_category: c.subCategory.trim(),
        code: c.code.trim(),
      }));

      // Insert in chunks of 50 to respect payload limits
      const chunkSize = 50;
      for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
        const chunk = rowsToInsert.slice(i, i + chunkSize);
        const { error } = await supabase.from('rcd_account_codes').insert(chunk);
        if (error) {
          console.error('Error inserting chunk of account codes:', error);
        }
      }

      return { success: true, count: codes.length };
    } catch (e) {
      console.error('Error importing account codes to Supabase:', e);
    }
  }

  // LocalStorage Fallback
  const currentCodes = replaceExisting ? [] : await getAccountCodes();
  let nextId = currentCodes.length > 0 ? Math.max(...currentCodes.map(c => c.id)) + 1 : 1;

  const newCodes: AccountCode[] = [...currentCodes];
  for (const c of codes) {
    newCodes.push({
      id: nextId++,
      mainCategory: c.mainCategory.trim() || 'General Revenue',
      subCategory: c.subCategory.trim(),
      code: c.code.trim(),
    });
  }

  localStorage.setItem('account_codes', JSON.stringify(newCodes));
  return { success: true, count: codes.length };
};

// ============================================================================
// 3. SIGNATORIES (Table: rcd_signatories)
// ============================================================================

export interface CollectorSignatoryProfile {
  accountableName: string;
  position: string;
  department: string;
}

export const getSignatories = async (): Promise<Signatory[]> => {
  let globalSignatories: Signatory[] = [
    { id: 1, fullName: 'ACCOUNTABLE OFFICER', position: 'Revenue Collection Clerk I', department: 'Office of the Municipal Treasurer', remarks: "Treasurer's Office Staff / Certification" },
    { id: 2, fullName: 'MENARD A. HERRERA', position: 'Municipal Treasurer', department: 'Office of the Municipal Treasurer', remarks: 'Municipal Treasurer / Verification & Acknowledgment' },
    { id: 3, fullName: 'LEON F. PAZ, JR.', position: 'Municipal Accountant', department: 'Office of the Municipal Accountant', remarks: 'Municipal Accountant / Certified Correct' },
    { id: 4, fullName: 'HESTHER F. FANOGA', position: 'AA II', department: 'Office of the Municipal Accountant', remarks: 'Accounting Staff / Prepared by' },
  ];

  if (isSupabaseConfigured()) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Fetch Global official signatories (user_id is null)
      const { data: globalData, error: globalErr } = await supabase
        .from('rcd_signatories')
        .select('*')
        .is('user_id', null)
        .order('id', { ascending: true });

      if (!globalErr && globalData && globalData.length > 0) {
        globalSignatories = globalData.map((row: any) => ({
          id: row.id,
          fullName: row.full_name,
          position: row.position,
          department: row.department,
          remarks: row.remarks || '',
        }));
      }

      // 2. If user is logged in, fetch their personal Certification signatory
      if (user) {
        const { data: userData } = await supabase
          .from('rcd_signatories')
          .select('*')
          .eq('user_id', user.id)
          .order('id', { ascending: false })
          .limit(1);

        if (userData && userData.length > 0) {
          const userCert = userData[0];
          const certIdx = globalSignatories.findIndex(s => 
            s.id === 1 || 
            s.remarks?.toLowerCase().includes('certification') ||
            (s.department.toLowerCase().includes('treasurer') && !s.position.toLowerCase().includes('municipal treasurer'))
          );
          if (certIdx >= 0) {
            globalSignatories[certIdx] = {
              id: userCert.id,
              fullName: userCert.full_name,
              position: userCert.position,
              department: userCert.department,
              remarks: userCert.remarks || "Treasurer's Office Staff / Certification",
            };
          }
        } else if (user.user_metadata?.full_name) {
          // If no custom signatory saved yet, default Certification name to user's name
          const certIdx = globalSignatories.findIndex(s => s.id === 1 || s.remarks?.toLowerCase().includes('certification'));
          if (certIdx >= 0) {
            globalSignatories[certIdx] = {
              ...globalSignatories[certIdx],
              fullName: user.user_metadata.full_name.toUpperCase(),
            };
          }
        }
      }

      return globalSignatories;
    } catch (e) {
      console.warn('Error fetching signatories from Supabase:', e);
    }
  }

  // Fallback to localStorage
  const stored = localStorage.getItem('signatories');
  if (stored) {
    try {
      globalSignatories = JSON.parse(stored);
    } catch {}
  }

  const currentUserStr = localStorage.getItem('rcd_current_user') || localStorage.getItem('rcd_user');
  let currentUserId = 'default';
  if (currentUserStr) {
    try {
      const u = JSON.parse(currentUserStr);
      currentUserId = u.id || u.email || 'default';
    } catch {}
  }

  const userCertStored = localStorage.getItem(`user_cert_signatory_${currentUserId}`);
  if (userCertStored) {
    try {
      const userCert = JSON.parse(userCertStored);
      const certIdx = globalSignatories.findIndex(s => s.id === 1 || s.remarks?.toLowerCase().includes('certification'));
      if (certIdx >= 0) {
        globalSignatories[certIdx] = userCert;
      }
    } catch {}
  }

  return globalSignatories;
};

export const getCollectorSignatoryProfile = async (): Promise<CollectorSignatoryProfile> => {
  let defaultProfile: CollectorSignatoryProfile = {
    accountableName: '',
    position: 'Revenue Collection Clerk I',
    department: 'Office of the Municipal Treasurer'
  };

  if (isSupabaseConfigured()) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        defaultProfile.accountableName = user.user_metadata?.full_name || '';
        const { data, error } = await supabase
          .from('rcd_signatories')
          .select('*')
          .eq('user_id', user.id)
          .order('id', { ascending: false })
          .limit(1);

        if (!error && data && data.length > 0) {
          return {
            accountableName: data[0].full_name || defaultProfile.accountableName,
            position: data[0].position || defaultProfile.position,
            department: data[0].department || defaultProfile.department,
          };
        }
      }
    } catch (e) {
      console.warn('Error fetching collector signatory profile from Supabase:', e);
    }
  }

  const currentUserStr = localStorage.getItem('rcd_current_user') || localStorage.getItem('rcd_user');
  let currentUserId = 'default';
  if (currentUserStr) {
    try {
      const u = JSON.parse(currentUserStr);
      currentUserId = u.id || u.email || 'default';
      defaultProfile.accountableName = u.name || '';
    } catch {}
  }
  const userCertStored = localStorage.getItem(`user_cert_signatory_${currentUserId}`);
  if (userCertStored) {
    try {
      const cert = JSON.parse(userCertStored);
      return {
        accountableName: cert.fullName || defaultProfile.accountableName,
        position: cert.position || defaultProfile.position,
        department: cert.department || defaultProfile.department,
      };
    } catch {}
  }

  return defaultProfile;
};

export const saveCollectorSignatoryProfile = async (profile: CollectorSignatoryProfile): Promise<boolean> => {
  if (isSupabaseConfigured()) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: existing } = await supabase
        .from('rcd_signatories')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (existing && existing.length > 0) {
        const { error } = await supabase
          .from('rcd_signatories')
          .update({
            full_name: profile.accountableName.toUpperCase(),
            position: profile.position,
            department: profile.department,
            remarks: "Treasurer's Office Staff / Certification",
          })
          .eq('id', existing[0].id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('rcd_signatories')
          .insert({
            user_id: user.id,
            full_name: profile.accountableName.toUpperCase(),
            position: profile.position,
            department: profile.department,
            remarks: "Treasurer's Office Staff / Certification",
          });
        if (error) throw error;
      }
      return true;
    } catch (e) {
      console.error('Error saving collector signatory profile to Supabase:', e);
    }
  }

  const currentUserStr = localStorage.getItem('rcd_current_user') || localStorage.getItem('rcd_user');
  let currentUserId = 'default';
  if (currentUserStr) {
    try {
      const u = JSON.parse(currentUserStr);
      currentUserId = u.id || u.email || 'default';
    } catch {}
  }
  const signatoryObj: Signatory = {
    id: 1,
    fullName: profile.accountableName.toUpperCase(),
    position: profile.position,
    department: profile.department,
    remarks: "Treasurer's Office Staff / Certification"
  };
  localStorage.setItem(`user_cert_signatory_${currentUserId}`, JSON.stringify(signatoryObj));
  return true;
};

export const saveSignatory = async (signatory: Signatory): Promise<boolean> => {
  const isCertification = signatory.id === 1 || 
    signatory.remarks?.toLowerCase().includes('certification') ||
    (signatory.department.toLowerCase().includes('treasurer') && !signatory.position.toLowerCase().includes('municipal treasurer'));

  if (isSupabaseConfigured()) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (isCertification) {
        // Upsert personal Certification signatory for this collector
        const { data: existing } = await supabase
          .from('rcd_signatories')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);

        if (existing && existing.length > 0) {
          const { error } = await supabase
            .from('rcd_signatories')
            .update({
              full_name: signatory.fullName,
              position: signatory.position,
              department: signatory.department,
              remarks: signatory.remarks || "Treasurer's Office Staff / Certification",
            })
            .eq('id', existing[0].id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('rcd_signatories')
            .insert({
              user_id: user.id,
              full_name: signatory.fullName,
              position: signatory.position,
              department: signatory.department,
              remarks: signatory.remarks || "Treasurer's Office Staff / Certification",
            });
          if (error) throw error;
        }
        return true;
      } else {
        // Global official signatory (Admin only)
        if (signatory.id && signatory.id > 0) {
          const { error } = await supabase
            .from('rcd_signatories')
            .update({
              full_name: signatory.fullName,
              position: signatory.position,
              department: signatory.department,
              remarks: signatory.remarks || '',
            })
            .eq('id', signatory.id);
          if (error) throw error;
        }
        return true;
      }
    } catch (e) {
      console.error('Error saving signatory to Supabase:', e);
    }
  }

  // Fallback
  const currentUserStr = localStorage.getItem('rcd_current_user') || localStorage.getItem('rcd_user');
  let currentUserId = 'default';
  if (currentUserStr) {
    try {
      const u = JSON.parse(currentUserStr);
      currentUserId = u.id || u.email || 'default';
    } catch {}
  }

  if (isCertification) {
    localStorage.setItem(`user_cert_signatory_${currentUserId}`, JSON.stringify(signatory));
  } else {
    const current = JSON.parse(localStorage.getItem('signatories') || '[]');
    const index = current.findIndex((s: Signatory) => s.id === signatory.id);
    let updated;
    if (index >= 0) {
      updated = [...current];
      updated[index] = signatory;
    } else {
      const nextId = current.length > 0 ? Math.max(...current.map((s: Signatory) => s.id)) + 1 : 1;
      updated = [...current, { ...signatory, id: signatory.id || nextId }];
    }
    localStorage.setItem('signatories', JSON.stringify(updated));
  }
  return true;
};

export const deleteSignatory = async (id: number): Promise<boolean> => {
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from('rcd_signatories')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return true;
    } catch (e) {
      console.error('Error deleting signatory from Supabase:', e);
    }
  }

  const current = JSON.parse(localStorage.getItem('signatories') || '[]');
  const newSignatories = current.filter((s: Signatory) => s.id !== id);
  localStorage.setItem('signatories', JSON.stringify(newSignatories));
  return true;
};

// ============================================================================
// 4. GENERAL COLLECTIONS (Table: rcd_collections)
// ============================================================================

export const getCollectionEntries = async (): Promise<CollectionItem[]> => {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('rcd_collections')
        .select('*')
        .order('date', { ascending: false })
        .order('or_no', { ascending: false });

      if (error) throw error;

      if (data) {
        return data.map((row: any) => ({
          id: row.id,
          afNo: row.af_no || '',
          orNo: row.or_no || '',
          payor: row.payor || '',
          subCategory: row.sub_category || '',
          mainCategory: row.main_category || '',
          accountCode: row.account_code || '',
          amount: parseFloat(row.amount || 0),
          date: row.date || '',
          remarks: row.remarks || '',
        }));
      }
    } catch (e) {
      console.warn('Error fetching collections from Supabase:', e);
    }
  }

  const stored = localStorage.getItem('collection_entries');
  return stored ? JSON.parse(stored) : [];
};

export const saveCollectionEntry = async (entry: CollectionItem): Promise<boolean> => {
  if (isSupabaseConfigured()) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('rcd_collections')
        .insert({
          user_id: user.id,
          af_no: entry.afNo,
          or_no: entry.orNo,
          payor: entry.payor,
          sub_category: entry.subCategory,
          main_category: entry.mainCategory,
          account_code: entry.accountCode,
          amount: entry.amount,
          date: entry.date,
          remarks: entry.remarks,
        });

      if (error) throw error;
      return true;
    } catch (e) {
      console.error('Error saving collection to Supabase:', e);
    }
  }

  // Fallback
  const current = await getCollectionEntries();
  const nextId = current.length > 0 ? Math.max(...current.map(c => c.id)) + 1 : 1;
  const updated = [{ ...entry, id: entry.id || nextId }, ...current];
  localStorage.setItem('collection_entries', JSON.stringify(updated));
  return true;
};

export const saveCollectionEntryBulk = async (
  header: CollectionHeader,
  charges: CollectionCharge[]
): Promise<boolean> => {
  if (isSupabaseConfigured()) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const rows = charges.map(c => ({
        user_id: user.id,
        af_no: header.afNo,
        or_no: header.orNo,
        payor: header.payor,
        sub_category: c.subCategory,
        main_category: c.mainCategory,
        account_code: c.accountCode,
        amount: c.amount,
        date: header.date,
        remarks: header.remarks,
      }));

      const { error } = await supabase
        .from('rcd_collections')
        .insert(rows);

      if (error) throw error;
      return true;
    } catch (e) {
      console.error('Error bulk saving collections to Supabase:', e);
    }
  }

  // Fallback
  const current = await getCollectionEntries();
  let nextId = current.length > 0 ? Math.max(...current.map(c => c.id)) + 1 : 1;
  const newItems: CollectionItem[] = charges.map(c => ({
    id: nextId++,
    afNo: header.afNo,
    orNo: header.orNo,
    payor: header.payor,
    subCategory: c.subCategory,
    mainCategory: c.mainCategory,
    accountCode: c.accountCode,
    amount: c.amount,
    date: header.date,
    remarks: header.remarks,
  }));

  localStorage.setItem('collection_entries', JSON.stringify([...newItems, ...current]));
  return true;
};

export const importCollectionsBatch = async (
  entries: Array<Omit<CollectionItem, 'id'>>
): Promise<{ success: boolean; count: number }> => {
  if (entries.length === 0) return { success: true, count: 0 };

  if (isSupabaseConfigured()) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const rows = entries.map(e => ({
        user_id: user.id,
        af_no: e.afNo || '',
        or_no: e.orNo || '',
        payor: e.payor || '',
        sub_category: e.subCategory || '',
        main_category: e.mainCategory || '',
        account_code: e.accountCode || '',
        amount: Number(e.amount) || 0,
        date: e.date || new Date().toISOString().split('T')[0],
        remarks: e.remarks || '',
      }));

      // Insert in chunks of 500 to avoid payload limits
      const chunkSize = 500;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error } = await supabase
          .from('rcd_collections')
          .insert(chunk);
        if (error) throw error;
      }

      return { success: true, count: entries.length };
    } catch (e) {
      console.error('Error importing collections to Supabase:', e);
    }
  }

  // Fallback
  try {
    const current = await getCollectionEntries();
    let nextId = current.length > 0 ? Math.max(...current.map(c => c.id)) + 1 : 1;
    const newItems: CollectionItem[] = entries.map(e => ({
      id: nextId++,
      afNo: e.afNo || '',
      orNo: e.orNo || '',
      payor: e.payor || '',
      subCategory: e.subCategory || '',
      mainCategory: e.mainCategory || '',
      accountCode: e.accountCode || '',
      amount: Number(e.amount) || 0,
      date: e.date || new Date().toISOString().split('T')[0],
      remarks: e.remarks || '',
    }));

    localStorage.setItem('collection_entries', JSON.stringify([...newItems, ...current]));
    return { success: true, count: entries.length };
  } catch (err) {
    console.error('Failed to import to localStorage', err);
    return { success: false, count: 0 };
  }
};

export const updateCollectionEntry = async (entry: CollectionItem): Promise<boolean> => {
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from('rcd_collections')
        .update({
          af_no: entry.afNo,
          or_no: entry.orNo,
          payor: entry.payor,
          sub_category: entry.subCategory,
          main_category: entry.mainCategory,
          account_code: entry.accountCode,
          amount: entry.amount,
          date: entry.date,
          remarks: entry.remarks,
        })
        .eq('id', entry.id);

      if (error) throw error;
      return true;
    } catch (e) {
      console.error('Error updating collection in Supabase:', e);
    }
  }

  const current = await getCollectionEntries();
  const index = current.findIndex(c => c.id === entry.id);
  if (index >= 0) {
    current[index] = entry;
    localStorage.setItem('collection_entries', JSON.stringify(current));
    return true;
  }
  return false;
};

export const deleteCollectionEntry = async (id: number): Promise<boolean> => {
  return deleteCollectionGroup([id]);
};

export const deleteCollectionGroup = async (ids: number[], afNo?: string, orNo?: string): Promise<boolean> => {
  if (isSupabaseConfigured()) {
    try {
      if (ids && ids.length > 0) {
        const { error } = await supabase
          .from('rcd_collections')
          .delete()
          .in('id', ids);
        if (error) throw error;
        return true;
      } else if (afNo && orNo) {
        const { error } = await supabase
          .from('rcd_collections')
          .delete()
          .eq('af_no', afNo)
          .eq('or_no', orNo);
        if (error) throw error;
        return true;
      }
    } catch (e) {
      console.error('Error deleting collection group from Supabase:', e);
    }
  }

  const current = await getCollectionEntries();
  const idSet = new Set(ids || []);
  const filtered = current.filter(c => {
    if (idSet.has(c.id)) return false;
    if (afNo && orNo && c.afNo === afNo && c.orNo === orNo) return false;
    return true;
  });
  localStorage.setItem('collection_entries', JSON.stringify(filtered));
  return true;
};

export const updateCollectionGroup = async (
  idsToDelete: number[],
  header: CollectionHeader,
  charges: CollectionCharge[]
): Promise<boolean> => {
  if (idsToDelete.length > 0) {
    await deleteCollectionGroup(idsToDelete, header.afNo, header.orNo);
  }
  return saveCollectionEntryBulk(header, charges);
};

// ============================================================================
// 5. REAL PROPERTY TAX (RPT) COLLECTIONS (Table: rcd_rpt_collections)
// ============================================================================

export const getRPTCollections = async (): Promise<RPTCollectionItem[]> => {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('rcd_rpt_collections')
        .select('*')
        .order('date', { ascending: false })
        .order('or_number', { ascending: false });

      if (error) throw error;

      if (data) {
        return data.map((row: any) => ({
          id: row.id,
          af56Id: row.af56_id || '',
          orNumber: row.or_number || '',
          payor: row.payor || '',
          barangay: row.barangay || '',
          landName: row.land_name || '',
          tdNumber: row.td_number || '',
          yearsPaid: row.years_paid || '',
          amount: parseFloat(row.amount || 0),
          date: row.date || '',
          remarks: row.remarks || '',
        }));
      }
    } catch (e) {
      console.warn('Error fetching RPT collections from Supabase:', e);
    }
  }

  const stored = localStorage.getItem('rpt_collections');
  return stored ? JSON.parse(stored) : [];
};

export const saveRPTCollection = async (collection: RPTCollectionItem): Promise<boolean> => {
  if (isSupabaseConfigured()) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (collection.id && collection.id > 0) {
        const { error } = await supabase
          .from('rcd_rpt_collections')
          .upsert({
            id: collection.id,
            user_id: user.id,
            af56_id: collection.af56Id,
            or_number: collection.orNumber,
            payor: collection.payor,
            barangay: collection.barangay,
            land_name: collection.landName,
            td_number: collection.tdNumber,
            years_paid: collection.yearsPaid,
            amount: collection.amount,
            date: collection.date,
            remarks: collection.remarks || '',
          });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('rcd_rpt_collections')
          .insert({
            user_id: user.id,
            af56_id: collection.af56Id,
            or_number: collection.orNumber,
            payor: collection.payor,
            barangay: collection.barangay,
            land_name: collection.landName,
            td_number: collection.tdNumber,
            years_paid: collection.yearsPaid,
            amount: collection.amount,
            date: collection.date,
            remarks: collection.remarks || '',
          });
        if (error) throw error;
      }
      return true;
    } catch (e) {
      console.error('Error saving RPT collection to Supabase:', e);
    }
  }

  // Fallback
  const current = await getRPTCollections();
  const index = current.findIndex(c => c.id === collection.id);
  let updated;
  if (index >= 0) {
    updated = [...current];
    updated[index] = collection;
  } else {
    const nextId = current.length > 0 ? Math.max(...current.map(c => c.id)) + 1 : 1;
    updated = [{ ...collection, id: collection.id || nextId }, ...current];
  }
  localStorage.setItem('rpt_collections', JSON.stringify(updated));
  return true;
};

export const importRPTCollectionsBatch = async (
  entries: Array<Omit<RPTCollectionItem, 'id'>>
): Promise<{ success: boolean; count: number }> => {
  if (entries.length === 0) return { success: true, count: 0 };

  if (isSupabaseConfigured()) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const rows = entries.map(e => ({
        user_id: user.id,
        af56_id: e.af56Id || '',
        or_number: e.orNumber || '',
        payor: e.payor || '',
        barangay: e.barangay || '',
        land_name: e.landName || '',
        td_number: e.tdNumber || '',
        years_paid: e.yearsPaid || '',
        amount: Number(e.amount) || 0,
        date: e.date || new Date().toISOString().split('T')[0],
        remarks: e.remarks || '',
      }));

      // Insert in chunks of 500 to avoid payload limits
      const chunkSize = 500;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error } = await supabase
          .from('rcd_rpt_collections')
          .insert(chunk);
        if (error) throw error;
      }

      return { success: true, count: entries.length };
    } catch (e) {
      console.error('Error importing RPT collections to Supabase:', e);
    }
  }

  // Fallback
  try {
    const current = await getRPTCollections();
    let nextId = current.length > 0 ? Math.max(...current.map(c => c.id)) + 1 : 1;
    const newItems: RPTCollectionItem[] = entries.map(e => ({
      id: nextId++,
      af56Id: e.af56Id || '',
      orNumber: e.orNumber || '',
      payor: e.payor || '',
      barangay: e.barangay || '',
      landName: e.landName || '',
      tdNumber: e.tdNumber || '',
      yearsPaid: e.yearsPaid || '',
      amount: Number(e.amount) || 0,
      date: e.date || new Date().toISOString().split('T')[0],
      remarks: e.remarks || '',
    }));

    localStorage.setItem('rpt_collections', JSON.stringify([...newItems, ...current]));
    return { success: true, count: entries.length };
  } catch (err) {
    console.error('Failed to import RPT to localStorage', err);
    return { success: false, count: 0 };
  }
};

export const deleteRPTCollection = async (id: number): Promise<boolean> => {
  return deleteRPTCollectionGroup([id]);
};

export const deleteRPTCollectionGroup = async (ids: number[], af56Id?: string, orNumber?: string): Promise<boolean> => {
  if (isSupabaseConfigured()) {
    try {
      if (ids && ids.length > 0) {
        const { error } = await supabase
          .from('rcd_rpt_collections')
          .delete()
          .in('id', ids);
        if (error) throw error;
        return true;
      } else if (af56Id && orNumber) {
        const { error } = await supabase
          .from('rcd_rpt_collections')
          .delete()
          .eq('af56_id', af56Id)
          .eq('or_number', orNumber);
        if (error) throw error;
        return true;
      }
    } catch (e) {
      console.error('Error deleting RPT collection group from Supabase:', e);
    }
  }

  const current = await getRPTCollections();
  const idSet = new Set(ids || []);
  const filtered = current.filter(c => {
    if (idSet.has(c.id)) return false;
    if (af56Id && orNumber && c.af56Id === af56Id && c.orNumber === orNumber) return false;
    return true;
  });
  localStorage.setItem('rpt_collections', JSON.stringify(filtered));
  return true;
};

// ============================================================================
// 6. USER MANAGEMENT (Table: rcd_profiles & Local Storage)
// ============================================================================

export interface ManagedUser {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'user' | string;
  status: 'Active' | 'Inactive';
  createdAt?: string;
}

export const getAllManagedUsers = async (): Promise<ManagedUser[]> => {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('rcd_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map((u: any) => ({
          id: u.id,
          email: u.email,
          fullName: u.full_name || u.email?.split('@')[0] || 'Unknown User',
          role: u.role || 'user',
          status: 'Active',
          createdAt: u.created_at || new Date().toISOString()
        }));
      }
    } catch (e) {
      console.warn('Error loading users from Supabase, checking local storage:', e);
    }
  }

  const stored = localStorage.getItem('rcd_managed_users');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // ignore
    }
  }

  const defaultUsers: ManagedUser[] = [
    { id: 'usr-1', email: 'admin@rcd.gov.ph', fullName: 'System Administrator', role: 'admin', status: 'Active', createdAt: '2026-01-01T08:00:00.000Z' },
    { id: 'usr-2', email: 'collector@rcd.gov.ph', fullName: 'Menard A. Herrera', role: 'user', status: 'Active', createdAt: '2026-01-05T08:00:00.000Z' },
    { id: 'usr-3', email: 'maria.santos@rcd.gov.ph', fullName: 'Maria Santos, CPA', role: 'admin', status: 'Active', createdAt: '2026-01-10T08:00:00.000Z' },
    { id: 'usr-4', email: 'hesther.fanoga@rcd.gov.ph', fullName: 'Hesther F. Fanoga', role: 'user', status: 'Active', createdAt: '2026-01-15T08:00:00.000Z' },
    { id: 'usr-5', email: 'pedro.reyes@rcd.gov.ph', fullName: 'Pedro Reyes', role: 'admin', status: 'Active', createdAt: '2026-01-20T08:00:00.000Z' }
  ];
  localStorage.setItem('rcd_managed_users', JSON.stringify(defaultUsers));
  return defaultUsers;
};

export const createManagedUser = async (user: { email: string; fullName: string; role: string; password?: string; status?: 'Active' | 'Inactive' }): Promise<ManagedUser | null> => {
  const newId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'usr_' + Date.now();
  
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('rcd_profiles')
        .insert({
          id: newId,
          email: user.email,
          full_name: user.fullName,
          role: user.role.toLowerCase()
        })
        .select()
        .single();

      if (!error && data) {
        return {
          id: data.id,
          email: data.email,
          fullName: data.full_name,
          role: data.role,
          status: user.status || 'Active',
          createdAt: data.created_at
        };
      }
    } catch (e) {
      console.warn('Error creating user in Supabase:', e);
    }
  }

  const current = await getAllManagedUsers();
  const newUser: ManagedUser = {
    id: newId,
    email: user.email,
    fullName: user.fullName,
    role: user.role.toLowerCase(),
    status: user.status || 'Active',
    createdAt: new Date().toISOString()
  };
  const updated = [newUser, ...current];
  localStorage.setItem('rcd_managed_users', JSON.stringify(updated));
  return newUser;
};

export const updateManagedUser = async (id: string, user: { email?: string; fullName: string; role: string; status?: 'Active' | 'Inactive' }): Promise<boolean> => {
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from('rcd_profiles')
        .update({
          full_name: user.fullName,
          role: user.role.toLowerCase(),
          ...(user.email ? { email: user.email } : {})
        })
        .eq('id', id);

      if (!error) return true;
    } catch (e) {
      console.warn('Error updating user in Supabase:', e);
    }
  }

  const current = await getAllManagedUsers();
  const updated = current.map(u => u.id === id ? {
    ...u,
    fullName: user.fullName,
    role: user.role.toLowerCase(),
    status: user.status || u.status,
    ...(user.email ? { email: user.email } : {})
  } : u);
  localStorage.setItem('rcd_managed_users', JSON.stringify(updated));
  return true;
};

export const deleteManagedUser = async (id: string): Promise<boolean> => {
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from('rcd_profiles')
        .delete()
        .eq('id', id);

      if (!error) return true;
    } catch (e) {
      console.warn('Error deleting user from Supabase:', e);
    }
  }

  const current = await getAllManagedUsers();
  const updated = current.filter(u => u.id !== id);
  localStorage.setItem('rcd_managed_users', JSON.stringify(updated));
  return true;
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('rcd_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      if (data) {
        return {
          id: data.id,
          email: data.email,
          name: data.full_name || '',
          role: data.role || 'Collector',
        };
      }
    } catch (e) {
      console.warn('Error fetching profile from Supabase:', e);
    }
  }

  const storedUser = localStorage.getItem('rcd_user');
  if (storedUser) {
    try {
      return JSON.parse(storedUser);
    } catch {
      return null;
    }
  }
  return null;
};
