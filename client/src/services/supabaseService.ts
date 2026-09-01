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
  collectorEmail?: string;
  userId?: string;
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

/**
 * Helper to fetch ALL rows from Supabase, removing the default 1000-row limit
 * by retrieving all pages in chunks of 1000 until all records are returned.
 */
async function fetchAllRows<T = any>(
  queryFn: (from: number, to: number) => Promise<{ data: T[] | null; error: any }>
): Promise<T[]> {
  const CHUNK_SIZE = 1000;
  let allRows: T[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const to = from + CHUNK_SIZE - 1;
    const { data, error } = await queryFn(from, to);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < CHUNK_SIZE) {
      hasMore = false;
    } else {
      from += CHUNK_SIZE;
    }
  }

  return allRows;
};

export const getCurrentLocalUser = () => {
  const stored = localStorage.getItem('rcd_user');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {}
  }
  return null;
};

export const isValidUuid = (id: any): boolean =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export const isCurrentUserAdmin = (): boolean => {
  const user = getCurrentLocalUser();
  if (!user) return false;
  const role = user.role?.toLowerCase();
  return role === 'admin' || role === 'administrator';
};

// ============================================================================
// 1. RCD REPORTS (Table: rcd_reports)
// ============================================================================

export const submitRCDReport = async (report: RCDReport): Promise<boolean> => {
  const user = getCurrentLocalUser();
  const userId = isValidUuid(user?.id) ? user.id : null;
  const collectorEmail = user?.email ? user.email.toLowerCase().trim() : null;

  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from('rcd_reports')
        .insert({
          user_id: userId,
          collector_email: collectorEmail,
          report_number: report.reportNumber,
          date: report.date || new Date().toISOString().split('T')[0],
          collector_name: report.collectorName || user?.name || user?.email || 'Revenue Collector',
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
    const newReports = [{ ...report, collectorEmail, userId }, ...existingReports];
    localStorage.setItem('rcd_reports', JSON.stringify(newReports));
    return true;
  } catch (e) {
    console.error('Failed to save to localStorage', e);
    return false;
  }
};

export const getRecentReports = async (): Promise<RCDReport[]> => {
  const user = getCurrentLocalUser();
  const isAdmin = isCurrentUserAdmin();
  const userEmail = user?.email?.toLowerCase().trim();
  const userName = user?.name?.toLowerCase().trim();

  if (isSupabaseConfigured()) {
    try {
      let data = await fetchAllRows(async (from, to) => {
        let query = supabase
          .from('rcd_reports')
          .select('*')
          .order('created_at', { ascending: false });

        if (!isAdmin) {
          const filterParts: string[] = [];
          if (userEmail) filterParts.push(`collector_email.ilike.${userEmail}`);
          if (isValidUuid(user?.id)) filterParts.push(`user_id.eq.${user.id}`);
          if (filterParts.length > 0) {
            query = query.or(filterParts.join(','));
          }
        }

        return await query.range(from, to);
      });

      if (data && data.length > 0) {
        // Enforce strict collector isolation if not admin
        if (!isAdmin && user) {
          data = data.filter((row: any) => {
            const rowEmail = row.collector_email?.toLowerCase().trim();
            const rowUserId = row.user_id;
            const rowCollector = row.collector_name?.toLowerCase().trim();

            if (rowEmail && userEmail) return rowEmail === userEmail;
            if (rowUserId && user.id) return rowUserId === user.id;
            if (rowCollector && (userName || userEmail)) {
              return (userName && rowCollector.includes(userName)) || (userEmail && rowCollector.includes(userEmail));
            }
            return false;
          });
        }

        return data.map((row: any) => ({
          id: row.id,
          date: row.date,
          reportNumber: row.report_number,
          collectorName: row.collector_name,
          collectorEmail: row.collector_email || undefined,
          userId: row.user_id || undefined,
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
    const local = JSON.parse(localStorage.getItem('rcd_reports') || '[]');
    if (!isAdmin && user) {
      return local.filter((r: any) => {
        const rEmail = r.collectorEmail?.toLowerCase().trim();
        const rUserId = r.userId;
        const rCollector = r.collectorName?.toLowerCase().trim();

        if (rEmail && userEmail) return rEmail === userEmail;
        if (rUserId && user.id) return rUserId === user.id;
        if (rCollector && (userName || userEmail)) {
          return (userName && rCollector.includes(userName)) || (userEmail && rCollector.includes(userEmail));
        }
        return false;
      });
    }
    return local;
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
      const data = await fetchAllRows(async (from, to) => {
        return await supabase
          .from('rcd_account_codes')
          .select('*')
          .order('id', { ascending: true })
          .range(from, to);
      });

      if (data && data.length > 0) {
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
      const user = getCurrentLocalUser();
      const userId = user?.id || null;

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
            user_id: userId,
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
      const user = getCurrentLocalUser();
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

export const getOfficialSignatories = async (): Promise<Signatory[]> => {
  let officialMunicipalSignatories: Signatory[] = [
    { id: 44, fullName: 'MENARD A. HERRERA', position: 'Municipal Treasurer', department: 'Office of the Municipal Treasurer', remarks: 'Municipal Treasurer / Verification & Acknowledgment' },
    { id: 45, fullName: 'LEON F. PAZ, JR.', position: 'Municipal Accountant', department: 'Office of the Municipal Accountant', remarks: 'Municipal Accountant / Certified Correct' },
    { id: 46, fullName: 'HESTHER F. FANOGA', position: 'AA II', department: 'Office of the Municipal Accountant', remarks: 'Accounting Staff / Prepared by' },
  ];

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('rcd_signatories')
        .select('*')
        .is('user_id', null)
        .order('id', { ascending: true })
        .limit(3);

      if (!error && data && data.length > 0) {
        officialMunicipalSignatories = data.map((row: any) => ({
          id: row.id,
          fullName: row.full_name,
          position: row.position,
          department: row.department,
          remarks: row.remarks || '',
        }));
      } else {
        // Auto-seed official municipal signatories into Supabase if empty
        const defaultSignatories = [
          {
            user_id: null,
            full_name: 'MENARD A. HERRERA',
            position: 'Municipal Treasurer',
            department: 'Office of the Municipal Treasurer',
            remarks: 'Municipal Treasurer / Verification & Acknowledgment'
          },
          {
            user_id: null,
            full_name: 'LEON F. PAZ, JR.',
            position: 'Municipal Accountant',
            department: 'Office of the Municipal Accountant',
            remarks: 'Municipal Accountant / Certified Correct'
          },
          {
            user_id: null,
            full_name: 'HESTHER F. FANOGA',
            position: 'AA II',
            department: 'Office of the Municipal Accountant',
            remarks: 'Accounting Staff / Prepared by'
          }
        ];
        const { data: inserted } = await supabase.from('rcd_signatories').insert(defaultSignatories).select();
        if (inserted && inserted.length > 0) {
          officialMunicipalSignatories = inserted.map((row: any) => ({
            id: row.id,
            fullName: row.full_name,
            position: row.position,
            department: row.department,
            remarks: row.remarks || '',
          }));
        }
      }
    } catch (e) {
      console.warn('Error fetching official signatories from Supabase:', e);
    }
  }

  try {
    localStorage.setItem('official_signatories', JSON.stringify(officialMunicipalSignatories));
  } catch {}

  return officialMunicipalSignatories;
};

export const getSignatories = async (): Promise<Signatory[]> => {
  let officialMunicipalSignatories = await getOfficialSignatories();

  // Default / fallback collector certification signatory
  let certSignatory: Signatory = {
    id: 1,
    fullName: 'ACCOUNTABLE OFFICER',
    position: 'Revenue Collection Clerk I',
    department: 'Office of the Municipal Treasurer',
    remarks: "Treasurer's Office Staff / Certification"
  };

  // Check localStorage for logged-in user or cached cert signatory
  const currentUserStr = localStorage.getItem('rcd_current_user') || localStorage.getItem('rcd_user');
  let currentUserId = 'default';
  if (currentUserStr) {
    try {
      const u = JSON.parse(currentUserStr);
      currentUserId = u.id || u.email || 'default';
      if (u.name) certSignatory.fullName = u.name.toUpperCase();
    } catch {}
  }

  const userCertStored = localStorage.getItem(`user_cert_signatory_${currentUserId}`) || localStorage.getItem('user_cert_signatory_default');
  if (userCertStored) {
    try {
      const parsed = JSON.parse(userCertStored);
      if (parsed.fullName || parsed.full_name || parsed.accountableName) {
        certSignatory.fullName = (parsed.fullName || parsed.full_name || parsed.accountableName).toUpperCase();
      }
      if (parsed.position) certSignatory.position = parsed.position;
      if (parsed.department) certSignatory.department = parsed.department;
    } catch {}
  }

  if (isSupabaseConfigured()) {
    try {
      const user = getCurrentLocalUser();

      // 2. Fetch Personal Certification Signatory for logged-in collector
      if (user) {
        if (user.name && certSignatory.fullName === 'ACCOUNTABLE OFFICER') {
          certSignatory.fullName = user.name.toUpperCase();
        }

        const userUuid = isValidUuid(user.id) ? user.id : null;
        if (userUuid) {
          const { data: userData, error: userErr } = await supabase
            .from('rcd_signatories')
            .select('*')
            .eq('user_id', userUuid)
            .order('id', { ascending: false })
            .limit(1);

          if (!userErr && userData && userData.length > 0) {
            certSignatory = {
              id: userData[0].id,
              fullName: (userData[0].full_name || certSignatory.fullName).toUpperCase(),
              position: userData[0].position || certSignatory.position,
              department: userData[0].department || certSignatory.department,
              remarks: userData[0].remarks || "Treasurer's Office Staff / Certification",
            };

            // Cache in local storage for instant access across tabs/views
            localStorage.setItem(`user_cert_signatory_${user.id}`, JSON.stringify(certSignatory));
            localStorage.setItem('user_cert_signatory_default', JSON.stringify(certSignatory));
          }
        }
      }
    } catch (e) {
      console.warn('Error fetching signatories from Supabase:', e);
    }
  }

  // Ensure Certification is always index 0, followed by the 3 official municipal roles
  const filteredOfficials = officialMunicipalSignatories.filter(s => 
    !s.remarks?.toLowerCase().includes('certification') &&
    s.position?.toLowerCase() !== 'revenue collection clerk i'
  );

  const combined = [certSignatory, ...filteredOfficials];
  try {
    localStorage.setItem('signatories', JSON.stringify(combined));
  } catch {}
  return combined;
};

export const getCollectorSignatoryProfile = async (): Promise<CollectorSignatoryProfile> => {
  let defaultProfile: CollectorSignatoryProfile = {
    accountableName: '',
    position: 'Revenue Collection Clerk I',
    department: 'Office of the Municipal Treasurer'
  };

  const currentUserStr = localStorage.getItem('rcd_current_user') || localStorage.getItem('rcd_user');
  let currentUserId = 'default';
  if (currentUserStr) {
    try {
      const u = JSON.parse(currentUserStr);
      currentUserId = u.id || u.email || 'default';
      if (u.name) defaultProfile.accountableName = u.name;
    } catch {}
  }

  const userCertStored = localStorage.getItem(`user_cert_signatory_${currentUserId}`) || localStorage.getItem('user_cert_signatory_default');
  if (userCertStored) {
    try {
      const cert = JSON.parse(userCertStored);
      defaultProfile = {
        accountableName: cert.fullName || cert.full_name || cert.accountableName || defaultProfile.accountableName,
        position: cert.position || defaultProfile.position,
        department: cert.department || defaultProfile.department,
      };
    } catch {}
  }

  if (isSupabaseConfigured()) {
    try {
      const user = getCurrentLocalUser();
      if (user) {
        if (!defaultProfile.accountableName && user.name) {
          defaultProfile.accountableName = user.name;
        }

        const userUuid = isValidUuid(user.id) ? user.id : null;
        if (userUuid) {
          const { data, error } = await supabase
            .from('rcd_signatories')
            .select('*')
            .eq('user_id', userUuid)
            .order('id', { ascending: false })
            .limit(1);

          if (!error && data && data.length > 0) {
            const profile = {
              accountableName: data[0].full_name || defaultProfile.accountableName,
              position: data[0].position || defaultProfile.position,
              department: data[0].department || defaultProfile.department,
            };
            localStorage.setItem(`user_cert_signatory_${user.id}`, JSON.stringify({
              id: data[0].id,
              fullName: profile.accountableName.toUpperCase(),
              position: profile.position,
              department: profile.department,
              remarks: "Treasurer's Office Staff / Certification"
            }));
            return profile;
          }
        }
      }
    } catch (e) {
      console.warn('Error fetching collector signatory profile from Supabase:', e);
    }
  }

  return defaultProfile;
};

export const saveCollectorSignatoryProfile = async (profile: CollectorSignatoryProfile): Promise<boolean> => {
  const nameToSave = profile.accountableName.trim().toUpperCase();
  const positionToSave = profile.position?.trim() || 'Revenue Collection Clerk I';
  const departmentToSave = profile.department?.trim() || 'Office of the Municipal Treasurer';

  const signatoryObj: Signatory = {
    id: 1,
    fullName: nameToSave,
    position: positionToSave,
    department: departmentToSave,
    remarks: "Treasurer's Office Staff / Certification"
  };

  const currentUserStr = localStorage.getItem('rcd_current_user') || localStorage.getItem('rcd_user');
  let currentUserId = 'default';
  if (currentUserStr) {
    try {
      const u = JSON.parse(currentUserStr);
      currentUserId = u.id || u.email || 'default';
      u.name = nameToSave;
      localStorage.setItem('rcd_current_user', JSON.stringify(u));
    } catch {}
  }
  localStorage.setItem(`user_cert_signatory_${currentUserId}`, JSON.stringify(signatoryObj));
  localStorage.setItem('user_cert_signatory_default', JSON.stringify(signatoryObj));

  if (isSupabaseConfigured()) {
    try {
      const user = getCurrentLocalUser();
      if (user) {
        localStorage.setItem(`user_cert_signatory_${user.id}`, JSON.stringify(signatoryObj));
        const userUuid = isValidUuid(user.id) ? user.id : null;

        let existingId: number | null = null;
        if (userUuid) {
          const { data: existing, error: findErr } = await supabase
            .from('rcd_signatories')
            .select('id')
            .eq('user_id', userUuid)
            .limit(1);

          if (!findErr && existing && existing.length > 0) {
            existingId = existing[0].id;
          }
        }

        if (existingId) {
          const { error } = await supabase
            .from('rcd_signatories')
            .update({
              full_name: nameToSave,
              position: positionToSave,
              department: departmentToSave,
              remarks: "Treasurer's Office Staff / Certification",
            })
            .eq('id', existingId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('rcd_signatories')
            .insert({
              user_id: userUuid,
              full_name: nameToSave,
              position: positionToSave,
              department: departmentToSave,
              remarks: "Treasurer's Office Staff / Certification",
            });
          if (error) throw error;
        }
        return true;
      }
    } catch (e) {
      console.error('Error saving collector signatory profile to Supabase:', e);
    }
  }

  return true;
};

export const saveSignatory = async (signatory: Signatory): Promise<boolean> => {
  const isCertification = signatory.id === 1 || 
    signatory.remarks?.toLowerCase().includes('certification') ||
    (signatory.department?.toLowerCase().includes('treasurer') && !signatory.position?.toLowerCase().includes('municipal treasurer'));

  if (isCertification) {
    return saveCollectorSignatoryProfile({
      accountableName: signatory.fullName,
      position: signatory.position,
      department: signatory.department
    });
  }

  if (isSupabaseConfigured()) {
    try {
      if (signatory.id && signatory.id > 0) {
        const { data: existing, error: checkErr } = await supabase
          .from('rcd_signatories')
          .select('id')
          .eq('id', signatory.id)
          .limit(1);

        if (!checkErr && existing && existing.length > 0) {
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
        } else {
          const { error } = await supabase
            .from('rcd_signatories')
            .insert({
              full_name: signatory.fullName,
              position: signatory.position,
              department: signatory.department,
              remarks: signatory.remarks || '',
              user_id: null
            });
          if (error) throw error;
        }
      } else {
        const { error } = await supabase
          .from('rcd_signatories')
          .insert({
            full_name: signatory.fullName,
            position: signatory.position,
            department: signatory.department,
            remarks: signatory.remarks || '',
            user_id: null
          });
        if (error) throw error;
      }
      return true;
    } catch (e) {
      console.error('Error saving global signatory to Supabase:', e);
    }
  }

  // Fallback to localStorage for global official signatories
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
  return true;
};

export const deleteSignatory = async (id: number): Promise<boolean> => {
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from('rcd_signatories')
        .delete()
        .eq('id', id);
      if (error) {
        console.error('Error deleting signatory from Supabase:', error);
      }
    } catch (e) {
      console.error('Error deleting signatory from Supabase:', e);
    }
  }

  try {
    const current = JSON.parse(localStorage.getItem('signatories') || '[]');
    const newSignatories = current.filter((s: Signatory) => s.id !== id);
    localStorage.setItem('signatories', JSON.stringify(newSignatories));
  } catch {}

  return true;
};

// ============================================================================
// 4. GENERAL COLLECTIONS (Table: rcd_collections)
// ============================================================================

export const getCollectionEntries = async (): Promise<CollectionItem[]> => {
  const user = getCurrentLocalUser();
  const isAdmin = isCurrentUserAdmin();
  const userEmail = user?.email?.toLowerCase().trim();

  let remoteItems: CollectionItem[] = [];

  if (isSupabaseConfigured()) {
    try {
      let data = await fetchAllRows(async (from, to) => {
        let query = supabase
          .from('rcd_collections')
          .select('*')
          .order('date', { ascending: false })
          .order('or_no', { ascending: false });

        if (!isAdmin) {
          const filterParts: string[] = [];
          if (userEmail) filterParts.push(`collector_email.ilike.${userEmail}`);
          if (isValidUuid(user?.id)) filterParts.push(`user_id.eq.${user.id}`);
          if (filterParts.length > 0) {
            query = query.or(filterParts.join(','));
          }
        }

        return await query.range(from, to);
      });

      if (data) {
        if (!isAdmin && user) {
          data = data.filter((row: any) => {
            const rowEmail = row.collector_email?.toLowerCase().trim();
            const rowUserId = row.user_id;

            if (rowEmail && userEmail) {
              return rowEmail === userEmail;
            }
            if (rowUserId && user.id) {
              return rowUserId === user.id;
            }
            return false;
          });
        }

        remoteItems = data.map((row: any) => ({
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
          collectorEmail: row.collector_email || undefined,
          userId: row.user_id || undefined,
        }));

        // Update local cache to match remote data exactly (prevents deleted rows from reviving)
        try {
          localStorage.setItem('collection_entries', JSON.stringify(remoteItems));
        } catch {}

        return remoteItems;
      }
    } catch (e) {
      console.warn('Error fetching collections from Supabase:', e);
    }
  }

  // Fallback to local storage ONLY if Supabase is offline or failed
  const stored = localStorage.getItem('collection_entries');
  if (stored) {
    try {
      const localList: CollectionItem[] = JSON.parse(stored);
      return (!isAdmin && user)
        ? localList.filter(item => {
            const itemEmail = item.collectorEmail?.toLowerCase().trim();
            const itemUserId = item.userId;
            if (itemEmail && userEmail) return itemEmail === userEmail;
            if (itemUserId && user.id) return itemUserId === user.id;
            return false;
          })
        : localList;
    } catch {}
  }

  return [];
};

export const saveCollectionEntry = async (entry: CollectionItem): Promise<boolean> => {
  const user = getCurrentLocalUser();
  const userId = isValidUuid(user?.id) ? user.id : null;
  const collectorEmail = user?.email ? user.email.toLowerCase().trim() : null;

  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from('rcd_collections')
        .insert({
          user_id: userId,
          collector_email: collectorEmail,
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

      if (error) {
        console.error('Error saving collection to Supabase:', error);
      } else {
        return true;
      }
    } catch (e) {
      console.error('Error saving collection to Supabase:', e);
    }
  }

  // Fallback / local backup
  const current = JSON.parse(localStorage.getItem('collection_entries') || '[]');
  const nextId = current.length > 0 ? Math.max(...current.map((c: any) => c.id || 0)) + 1 : 1;
  const updated = [{ ...entry, id: entry.id || nextId, collectorEmail, userId }, ...current];
  localStorage.setItem('collection_entries', JSON.stringify(updated));
  return true;
};

export const saveCollectionEntryBulk = async (
  header: CollectionHeader,
  charges: CollectionCharge[]
): Promise<boolean> => {
  const user = getCurrentLocalUser();
  const userId = isValidUuid(user?.id) ? user.id : null;
  const collectorEmail = user?.email ? user.email.toLowerCase().trim() : null;

  if (isSupabaseConfigured()) {
    try {
      const rows = charges.map(c => ({
        user_id: userId,
        collector_email: collectorEmail,
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

      if (error) {
        console.error('Error bulk saving collections to Supabase:', error);
      }
    } catch (e) {
      console.error('Error bulk saving collections to Supabase:', e);
    }
  }

  // Always keep local storage in sync as local cache / fallback
  const current = JSON.parse(localStorage.getItem('collection_entries') || '[]');
  let nextId = current.length > 0 ? Math.max(...current.map((c: any) => c.id || 0)) + 1 : 1;
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
    collectorEmail,
    userId,
  }));

  localStorage.setItem('collection_entries', JSON.stringify([...newItems, ...current]));
  return true;
};

export const importCollectionsBatch = async (
  entries: Array<Omit<CollectionItem, 'id'>>
): Promise<{ success: boolean; count: number }> => {
  if (entries.length === 0) return { success: true, count: 0 };
  const user = getCurrentLocalUser();
  const userId = isValidUuid(user?.id) ? user.id : null;
  const collectorEmail = user?.email ? user.email.toLowerCase().trim() : null;

  if (isSupabaseConfigured()) {
    try {
      const rows = entries.map(e => ({
        user_id: userId,
        collector_email: collectorEmail,
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
    const current = JSON.parse(localStorage.getItem('collection_entries') || '[]');
    let nextId = current.length > 0 ? Math.max(...current.map((c: any) => c.id || 0)) + 1 : 1;
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
      collectorEmail,
      userId,
    }));

    localStorage.setItem('collection_entries', JSON.stringify([...newItems, ...current]));
    return { success: true, count: entries.length };
  } catch (err) {
    console.error('Failed to import to localStorage', err);
    return { success: false, count: 0 };
  }
};

/**
 * Pushes any locally stored collections up to Supabase if they are not yet stored on the remote database.
 */
export const syncPendingLocalCollectionsToSupabase = async (): Promise<number> => {
  if (!isSupabaseConfigured()) return 0;
  const stored = localStorage.getItem('collection_entries');
  if (!stored) return 0;

  try {
    const localList: CollectionItem[] = JSON.parse(stored);
    if (localList.length === 0) return 0;

    const user = getCurrentLocalUser();
    const userId = isValidUuid(user?.id) ? user.id : null;
    const userEmail = user?.email ? user.email.toLowerCase().trim() : null;

    const remoteData = await fetchAllRows(async (from, to) => {
      return await supabase
        .from('rcd_collections')
        .select('af_no, or_no, sub_category, amount, date')
        .range(from, to);
    });

    const remoteKeys = new Set(
      (remoteData || []).map((r: any) => `${r.af_no}_${r.or_no}_${r.sub_category}_${parseFloat(r.amount || 0)}_${r.date}`)
    );

    const toUpload = localList.filter(l =>
      !remoteKeys.has(`${l.afNo}_${l.orNo}_${l.subCategory}_${Number(l.amount || 0)}_${l.date}`)
    );

    if (toUpload.length === 0) return 0;

    const rows = toUpload.map(e => ({
      user_id: isValidUuid(e.userId) ? e.userId : userId,
      collector_email: e.collectorEmail || userEmail,
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

    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await supabase.from('rcd_collections').insert(chunk);
      if (error) {
        console.error('Error syncing local collections to Supabase:', error);
        return 0;
      }
    }

    console.log(`Successfully synced ${toUpload.length} local collections to Supabase!`);
    return toUpload.length;
  } catch (err) {
    console.error('Failed to sync local collections to Supabase:', err);
    return 0;
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
        if (error) {
          console.error('Error deleting collection group from Supabase:', error);
        }
      } else if (afNo && orNo) {
        const { error } = await supabase
          .from('rcd_collections')
          .delete()
          .eq('af_no', afNo)
          .eq('or_no', orNo);
        if (error) {
          console.error('Error deleting collection group from Supabase:', error);
        }
      }
    } catch (e) {
      console.error('Error deleting collection group from Supabase:', e);
    }
  }

  // Always remove deleted items from local storage as well
  try {
    const stored = localStorage.getItem('collection_entries');
    if (stored) {
      const current: CollectionItem[] = JSON.parse(stored);
      const idSet = new Set(ids || []);
      const filtered = current.filter(c => {
        if (idSet.has(c.id)) return false;
        if (afNo && orNo && c.afNo === afNo && c.orNo === orNo) return false;
        return true;
      });
      localStorage.setItem('collection_entries', JSON.stringify(filtered));
    }
  } catch (err) {
    console.error('Error updating local storage after delete:', err);
  }

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
  const user = getCurrentLocalUser();
  const isAdmin = isCurrentUserAdmin();
  const userEmail = user?.email?.toLowerCase().trim();

  let remoteItems: RPTCollectionItem[] = [];

  if (isSupabaseConfigured()) {
    try {
      let data = await fetchAllRows(async (from, to) => {
        let query = supabase
          .from('rcd_rpt_collections')
          .select('*')
          .order('date', { ascending: false })
          .order('or_number', { ascending: false });

        if (!isAdmin) {
          const filterParts: string[] = [];
          if (userEmail) filterParts.push(`collector_email.ilike.${userEmail}`);
          if (isValidUuid(user?.id)) filterParts.push(`user_id.eq.${user.id}`);
          if (filterParts.length > 0) {
            query = query.or(filterParts.join(','));
          }
        }

        return await query.range(from, to);
      });

      if (data) {
        if (!isAdmin && user) {
          data = data.filter((row: any) => {
            const rowEmail = row.collector_email?.toLowerCase().trim();
            const rowUserId = row.user_id;

            if (rowEmail && userEmail) {
              return rowEmail === userEmail;
            }
            if (rowUserId && user.id) {
              return rowUserId === user.id;
            }
            return false;
          });
        }

        remoteItems = data.map((row: any) => ({
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
          collectorEmail: row.collector_email || undefined,
          userId: row.user_id || undefined,
        }));

        // Update local cache to match remote data exactly (prevents deleted rows from reviving)
        try {
          localStorage.setItem('rpt_collections', JSON.stringify(remoteItems));
        } catch {}

        return remoteItems;
      }
    } catch (e) {
      console.warn('Error fetching RPT collections from Supabase:', e);
    }
  }

  // Fallback to local storage ONLY if Supabase is offline or failed
  const stored = localStorage.getItem('rpt_collections');
  if (stored) {
    try {
      const localList: RPTCollectionItem[] = JSON.parse(stored);
      return (!isAdmin && user)
        ? localList.filter(item => {
            const itemEmail = item.collectorEmail?.toLowerCase().trim();
            const itemUserId = item.userId;
            if (itemEmail && userEmail) return itemEmail === userEmail;
            if (itemUserId && user.id) return itemUserId === user.id;
            return false;
          })
        : localList;
    } catch {}
  }

  return [];
};

export const saveRPTCollection = async (collection: RPTCollectionItem): Promise<boolean> => {
  const user = getCurrentLocalUser();
  const userId = isValidUuid(user?.id) ? user.id : null;
  const collectorEmail = user?.email ? user.email.toLowerCase().trim() : null;

  if (isSupabaseConfigured()) {
    try {
      if (collection.id && collection.id > 0) {
        const { error } = await supabase
          .from('rcd_rpt_collections')
          .upsert({
            id: collection.id,
            user_id: userId,
            collector_email: collectorEmail,
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
        if (error) {
          console.error('Error upserting RPT collection to Supabase:', error);
        } else {
          return true;
        }
      } else {
        const { error } = await supabase
          .from('rcd_rpt_collections')
          .insert({
            user_id: userId,
            collector_email: collectorEmail,
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
        if (error) {
          console.error('Error inserting RPT collection to Supabase:', error);
        } else {
          return true;
        }
      }
    } catch (e) {
      console.error('Error saving RPT collection to Supabase:', e);
    }
  }

  // Fallback
  const current = JSON.parse(localStorage.getItem('rpt_collections') || '[]');
  const index = current.findIndex((c: any) => c.id === collection.id);
  let updated;
  if (index >= 0) {
    updated = [...current];
    updated[index] = { ...collection, collectorEmail, userId };
  } else {
    const nextId = current.length > 0 ? Math.max(...current.map((c: any) => c.id || 0)) + 1 : 1;
    updated = [{ ...collection, id: collection.id || nextId, collectorEmail, userId }, ...current];
  }
  localStorage.setItem('rpt_collections', JSON.stringify(updated));
  return true;
};

export const importRPTCollectionsBatch = async (
  entries: Array<Omit<RPTCollectionItem, 'id'>>
): Promise<{ success: boolean; count: number }> => {
  if (entries.length === 0) return { success: true, count: 0 };
  const user = getCurrentLocalUser();
  const userId = isValidUuid(user?.id) ? user.id : null;
  const collectorEmail = user?.email ? user.email.toLowerCase().trim() : null;

  if (isSupabaseConfigured()) {
    try {
      const rows = entries.map(e => ({
        user_id: userId,
        collector_email: collectorEmail,
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
    const current = JSON.parse(localStorage.getItem('rpt_collections') || '[]');
    let nextId = current.length > 0 ? Math.max(...current.map((c: any) => c.id || 0)) + 1 : 1;
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
      collectorEmail,
      userId,
    }));

    localStorage.setItem('rpt_collections', JSON.stringify([...newItems, ...current]));
    return { success: true, count: entries.length };
  } catch (err) {
    console.error('Failed to import RPT to localStorage', err);
    return { success: false, count: 0 };
  }
};

/**
 * Pushes any locally stored RPT collections up to Supabase if they are not yet stored on the remote database.
 */
export const syncPendingLocalRPTCollectionsToSupabase = async (): Promise<number> => {
  if (!isSupabaseConfigured()) return 0;
  const stored = localStorage.getItem('rpt_collections');
  if (!stored) return 0;

  try {
    const localList: RPTCollectionItem[] = JSON.parse(stored);
    if (localList.length === 0) return 0;

    const user = getCurrentLocalUser();
    const userId = isValidUuid(user?.id) ? user.id : null;
    const userEmail = user?.email ? user.email.toLowerCase().trim() : null;

    const remoteData = await fetchAllRows(async (from, to) => {
      return await supabase
        .from('rcd_rpt_collections')
        .select('af56_id, or_number, amount, date')
        .range(from, to);
    });

    const remoteKeys = new Set(
      (remoteData || []).map((r: any) => `${r.af56_id}_${r.or_number}_${parseFloat(r.amount || 0)}_${r.date}`)
    );

    const toUpload = localList.filter(l =>
      !remoteKeys.has(`${l.af56Id}_${l.orNumber}_${Number(l.amount || 0)}_${l.date}`)
    );

    if (toUpload.length === 0) return 0;

    const rows = toUpload.map(e => ({
      user_id: isValidUuid(e.userId) ? e.userId : userId,
      collector_email: e.collectorEmail || userEmail,
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

    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await supabase.from('rcd_rpt_collections').insert(chunk);
      if (error) {
        console.error('Error syncing local RPT to Supabase:', error);
        return 0;
      }
    }

    console.log(`Successfully synced ${toUpload.length} local RPT collections to Supabase!`);
    return toUpload.length;
  } catch (err) {
    console.error('Failed to sync local RPT collections to Supabase:', err);
    return 0;
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
        if (error) {
          console.error('Error deleting RPT collection group from Supabase:', error);
        }
      } else if (af56Id && orNumber) {
        const { error } = await supabase
          .from('rcd_rpt_collections')
          .delete()
          .eq('af56_id', af56Id)
          .eq('or_number', orNumber);
        if (error) {
          console.error('Error deleting RPT collection group from Supabase:', error);
        }
      }
    } catch (e) {
      console.error('Error deleting RPT collection group from Supabase:', e);
    }
  }

  // Always remove deleted items from local storage as well
  try {
    const stored = localStorage.getItem('rpt_collections');
    if (stored) {
      const current: RPTCollectionItem[] = JSON.parse(stored);
      const idSet = new Set(ids || []);
      const filtered = current.filter(c => {
        if (idSet.has(c.id)) return false;
        if (af56Id && orNumber && c.af56Id === af56Id && c.orNumber === orNumber) return false;
        return true;
      });
      localStorage.setItem('rpt_collections', JSON.stringify(filtered));
    }
  } catch (err) {
    console.error('Error updating local storage after delete:', err);
  }

  return true;
};

// ============================================================================
// 6. USER MANAGEMENT (Table: public.users & Local Storage)
// ============================================================================

export interface ManagedUser {
  id: string; // maps to userid
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  password?: string;
  department?: string;
  position?: string;
  role: 'admin' | 'user' | string;
  status: 'Active' | 'Inactive';
  createdAt?: string;
  lastLogin?: string | null;
  signature?: string | null;
  signatureUrl?: string | null;
}

export const getAllManagedUsers = async (): Promise<ManagedUser[]> => {
  let dbUsers: ManagedUser[] = [];
  if (isSupabaseConfigured()) {
    try {
      const data = await fetchAllRows(async (from, to) => {
        return await supabase
          .from('users')
          .select('*')
          .order('datecreated', { ascending: false })
          .range(from, to);
      });

      if (data && data.length > 0) {
        dbUsers = data.map((u: any) => ({
          id: u.userid,
          firstName: u.firstname || '',
          lastName: u.lastname || '',
          fullName: `${u.firstname || ''} ${u.lastname || ''}`.trim() || u.email?.split('@')[0] || 'Unknown User',
          email: u.email || '',
          password: u.password || '',
          department: u.department || '',
          position: u.position || '',
          role: u.role || 'user',
          status: (u.status === 'Inactive' ? 'Inactive' : 'Active') as 'Active' | 'Inactive',
          createdAt: u.datecreated || new Date().toISOString(),
          lastLogin: u.lastlogin || null,
          signature: u.signature || null,
          signatureUrl: u.signature_url || null
        }));
      }
    } catch (e) {
      console.warn('Error loading users from public.users table, checking local storage:', e);
    }
  }

  const stored = localStorage.getItem('rcd_managed_users');
  let localUsers: ManagedUser[] = [];
  if (stored) {
    try {
      localUsers = JSON.parse(stored);
    } catch {
      // ignore
    }
  }

  if (dbUsers.length > 0) {
    // Merge any locally created accounts so newly created users are guaranteed to appear immediately
    const dbEmails = new Set(dbUsers.map(u => u.email?.toLowerCase()));
    const missingLocal = localUsers.filter(u => u.email && !dbEmails.has(u.email.toLowerCase()));
    const combined = [...dbUsers, ...missingLocal];
    localStorage.setItem('rcd_managed_users', JSON.stringify(combined));
    return combined;
  }

  if (localUsers.length > 0) {
    return localUsers;
  }

  const defaultUsers: ManagedUser[] = [
    { id: '11111111-1111-1111-1111-111111111111', firstName: 'System', lastName: 'Administrator', fullName: 'System Administrator', email: 'admin@rcd.gov.ph', password: 'admin', department: 'Treasury Office', position: 'Municipal Treasurer', role: 'admin', status: 'Active', createdAt: '2026-01-01T08:00:00.000Z' },
    { id: '22222222-2222-2222-2222-222222222222', firstName: 'Menard', lastName: 'Herrera', fullName: 'Menard A. Herrera', email: 'collector@rcd.gov.ph', password: 'user', department: 'Treasury Office', position: 'Revenue Collection Clerk II', role: 'user', status: 'Active', createdAt: '2026-01-05T08:00:00.000Z' },
    { id: '33333333-3333-3333-3333-333333333333', firstName: 'Maria', lastName: 'Santos', fullName: 'Maria Santos, CPA', email: 'maria.santos@rcd.gov.ph', password: 'password', department: 'Accounting Office', position: 'Municipal Accountant', role: 'admin', status: 'Active', createdAt: '2026-01-10T08:00:00.000Z' },
    { id: '44444444-4444-4444-4444-444444444444', firstName: 'Hesther', lastName: 'Fanoga', fullName: 'Hesther F. Fanoga', email: 'hesther.fanoga@rcd.gov.ph', password: 'password', department: 'Treasury Office', position: 'Revenue Collection Clerk I', role: 'user', status: 'Active', createdAt: '2026-01-15T08:00:00.000Z' },
    { id: '55555555-5555-5555-5555-555555555555', firstName: 'Pedro', lastName: 'Reyes', fullName: 'Pedro Reyes', email: 'pedro.reyes@rcd.gov.ph', password: 'password', department: 'Executive Office', position: 'Municipal Mayor', role: 'admin', status: 'Active', createdAt: '2026-01-20T08:00:00.000Z' }
  ];
  localStorage.setItem('rcd_managed_users', JSON.stringify(defaultUsers));
  return defaultUsers;
};

export const createManagedUser = async (user: { 
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email: string; 
  password: string;
  department?: string;
  position?: string;
  role: string; 
  status?: 'Active' | 'Inactive';
}): Promise<ManagedUser | null> => {
  const newId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'usr_' + Date.now();
  const initialStatus = user.status || 'Active';

  let fName = user.firstName?.trim() || '';
  let lName = user.lastName?.trim() || '';
  if (!fName && user.fullName) {
    const parts = user.fullName.trim().split(' ');
    fName = parts[0] || 'User';
    lName = parts.slice(1).join(' ') || '';
  }
  if (!fName) fName = user.email.split('@')[0];

  const full = `${fName} ${lName}`.trim();
  const cleanEmail = user.email.toLowerCase().trim();

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('users')
        .insert({
          userid: newId,
          firstname: fName,
          lastname: lName,
          password: user.password.trim(),
          department: user.department?.trim() || null,
          position: user.position?.trim() || null,
          role: user.role.toLowerCase(),
          email: cleanEmail,
          status: initialStatus,
          datecreated: new Date().toISOString()
        })
        .select()
        .single();

      if (!error && data) {
        const created: ManagedUser = {
          id: data.userid,
          firstName: data.firstname,
          lastName: data.lastname,
          fullName: `${data.firstname} ${data.lastname}`.trim(),
          email: data.email,
          password: data.password,
          department: data.department || '',
          position: data.position || '',
          role: data.role || 'user',
          status: (data.status as 'Active' | 'Inactive') || initialStatus,
          createdAt: data.datecreated
        };

        const stored = localStorage.getItem('rcd_managed_users');
        const list: ManagedUser[] = stored ? JSON.parse(stored) : [];
        const updated = [created, ...list.filter(u => u.email?.toLowerCase() !== cleanEmail && u.id !== created.id)];
        localStorage.setItem('rcd_managed_users', JSON.stringify(updated));
        return created;
      } else if (error) {
        console.warn('public.users insert note:', error.message);
      }
    } catch (e) {
      console.warn('Error creating user in public.users:', e);
    }
  }

  const current = await getAllManagedUsers();
  const newUser: ManagedUser = {
    id: newId,
    firstName: fName,
    lastName: lName,
    fullName: full,
    email: cleanEmail,
    password: user.password.trim(),
    department: user.department?.trim() || '',
    position: user.position?.trim() || '',
    role: user.role.toLowerCase(),
    status: initialStatus,
    createdAt: new Date().toISOString()
  };
  const updated = [newUser, ...current.filter(u => u.email?.toLowerCase() !== cleanEmail)];
  localStorage.setItem('rcd_managed_users', JSON.stringify(updated));
  return newUser;
};

export const updateManagedUser = async (id: string, user: { 
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string; 
  password?: string;
  department?: string;
  position?: string;
  role?: string; 
  status?: 'Active' | 'Inactive';
}): Promise<boolean> => {
  let fName = user.firstName?.trim();
  let lName = user.lastName?.trim();
  if (fName === undefined && user.fullName) {
    const parts = user.fullName.trim().split(' ');
    fName = parts[0];
    lName = parts.slice(1).join(' ');
  }

  if (isSupabaseConfigured()) {
    try {
      const updatePayload: any = {};
      if (fName !== undefined) updatePayload.firstname = fName;
      if (lName !== undefined) updatePayload.lastname = lName;
      if (user.email) updatePayload.email = user.email.toLowerCase().trim();
      if (user.password && user.password.trim()) updatePayload.password = user.password.trim();
      if (user.department !== undefined) updatePayload.department = user.department?.trim() || null;
      if (user.position !== undefined) updatePayload.position = user.position?.trim() || null;
      if (user.role) updatePayload.role = user.role.toLowerCase();
      if (user.status) updatePayload.status = user.status;

      const { error } = await supabase
        .from('users')
        .update(updatePayload)
        .eq('userid', id);

      if (error) {
        console.warn('Error updating public.users in Supabase:', error);
      }
    } catch (e) {
      console.warn('Error updating user in Supabase:', e);
    }
  }

  const current = await getAllManagedUsers();
  const updated = current.map(u => {
    if (u.id === id) {
      const newFirst = fName !== undefined ? fName : u.firstName;
      const newLast = lName !== undefined ? lName : u.lastName;
      return {
        ...u,
        firstName: newFirst,
        lastName: newLast,
        fullName: `${newFirst} ${newLast}`.trim(),
        role: user.role ? user.role.toLowerCase() : u.role,
        status: user.status || u.status,
        department: user.department !== undefined ? user.department : u.department,
        position: user.position !== undefined ? user.position : u.position,
        ...(user.email ? { email: user.email.toLowerCase().trim() } : {}),
        ...(user.password && user.password.trim() ? { password: user.password.trim() } : {})
      };
    }
    return u;
  });
  localStorage.setItem('rcd_managed_users', JSON.stringify(updated));
  return true;
};

export const deleteManagedUser = async (id: string): Promise<boolean> => {
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('userid', id);

      if (error) {
        console.warn('Error deleting user from public.users:', error);
      }
    } catch (e) {
      console.warn('Error deleting user from Supabase:', e);
    }
  }

  const stored = localStorage.getItem('rcd_managed_users');
  if (stored) {
    try {
      const current: ManagedUser[] = JSON.parse(stored);
      const updated = current.filter(u => u.id !== id);
      localStorage.setItem('rcd_managed_users', JSON.stringify(updated));
    } catch {}
  }
  return true;
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('userid', userId)
        .single();

      if (!error && data) {
        return {
          id: data.userid,
          email: data.email || '',
          name: `${data.firstname || ''} ${data.lastname || ''}`.trim() || data.email,
          role: data.role || 'user',
        };
      }
    } catch (e) {
      console.warn('Error fetching profile from public.users:', e);
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

// ============================================================================
// 10. LGU DEPARTMENTS SERVICE
// ============================================================================

export interface LguDepartment {
  id: string;
  departmentCode: string;
  departmentName: string;
  departmentAcronym?: string;
  description?: string;
  isActive?: boolean;
}

export const getLguDepartments = async (): Promise<LguDepartment[]> => {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('lgu_departments')
        .select('*')
        .order('department_name', { ascending: true });

      if (!error && data) {
        return data.map((d: any) => ({
          id: d.id,
          departmentCode: d.department_code,
          departmentName: d.department_name,
          departmentAcronym: d.department_acronym,
          description: d.description,
          isActive: d.is_active,
        }));
      }
    } catch (e) {
      console.warn('Error fetching lgu_departments:', e);
    }
  }

  // Fallback defaults
  return [
    { id: '1', departmentCode: 'TREASURER', departmentName: 'Municipal Treasurer Office', departmentAcronym: 'MTO', isActive: true },
    { id: '2', departmentCode: 'ACCOUNTING', departmentName: 'Municipal Accounting Office', departmentAcronym: 'MAO', isActive: true },
    { id: '3', departmentCode: 'BUDGET', departmentName: 'Municipal Budget Office', departmentAcronym: 'MBO', isActive: true },
    { id: '4', departmentCode: 'MAYOR', departmentName: 'Office of the Mayor', departmentAcronym: 'OMO', isActive: true },
  ];
};

// ============================================================================
// 11. ADMIN CONSOLIDATED REPORTS & SUBMISSION TRACKING
// ============================================================================

export interface AdminSubCategoryCharge {
  subCategory: string;
  mainCategory: string;
  accountCode: string;
  itemCount: number;
  amount: number;
}

export interface AdminSubmittedReportRecord {
  id: string;
  reportNumber: string;
  collectorName: string;
  collectorEmail?: string;
  userId?: string;
  afNo: string;
  orRange: string;
  orCount: number;
  orNumbers: string[];
  itemIds: number[];
  collectionType: 'general' | 'rpt';
  totalAmount: number;
  subCategorySummary: AdminSubCategoryCharge[];
  submittedAt: string;
  submittedBy: string;
  status: 'Submitted' | 'Verified';
  dateFrom: string;
  dateTo: string;
  notes?: string;
}

export const getAdminSubmittedReports = async (): Promise<AdminSubmittedReportRecord[]> => {
  const localStored: AdminSubmittedReportRecord[] = JSON.parse(
    localStorage.getItem('rcd_admin_submitted_reports') || '[]'
  );

  if (isSupabaseConfigured()) {
    try {
      const data = await fetchAllRows(async (from, to) => {
        return await supabase
          .from('rcd_reports')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, to);
      });

      if (data && data.length > 0) {
        const remoteReports: AdminSubmittedReportRecord[] = data.map((r: any) => {
          const colData = r.collections;
          const isStructured = colData && typeof colData === 'object' && !Array.isArray(colData);
          
          const subCategorySummary: AdminSubCategoryCharge[] = isStructured
            ? (colData.subCategories || colData.subCategorySummary || [])
            : (Array.isArray(colData) ? colData : []);

          // Extract Booklet No. (afNo)
          let afNo = isStructured && colData.afNo ? String(colData.afNo) : '';
          if (!afNo && r.report_number && r.report_number.startsWith('ADM-')) {
            const parts = r.report_number.split('-');
            if (parts.length >= 3) {
              afNo = parts[1]; // e.g. ADM-214-086207 -> "214"
            }
          }
          if (!afNo) {
            afNo = r.fund_type === 'SEF' ? 'A.F. NO. 56' : (r.report_number?.includes('56') ? 'A.F. NO. 56' : 'A.F. NO. 51');
          }

          // Extract OR Range
          let orRange = isStructured && colData.orRange ? colData.orRange : '';
          const orNumbers: string[] = isStructured && Array.isArray(colData.orNumbers)
            ? colData.orNumbers
            : subCategorySummary.map((c: any) => c.orNo || c.orNumber || '').filter(Boolean);

          if (!orRange && orNumbers.length > 0) {
            if (orNumbers.length === 1) orRange = orNumbers[0];
            else {
              const sorted = [...orNumbers].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
              orRange = `${sorted[0]} — ${sorted[sorted.length - 1]} (${sorted.length} ORs)`;
            }
          }
          if (!orRange) {
            orRange = r.report_number || '';
          }

          const orCount = isStructured && typeof colData.orCount === 'number'
            ? colData.orCount
            : (orNumbers.length || subCategorySummary.length);

          const itemIds: number[] = isStructured && Array.isArray(colData.itemIds)
            ? colData.itemIds
            : subCategorySummary.map((c: any) => c.id).filter(Boolean);

          const collectionType: 'general' | 'rpt' = (isStructured && colData.collectionType)
            ? colData.collectionType
            : (r.fund_type === 'SEF' || r.report_number?.includes('AF56') ? 'rpt' : 'general');

          return {
            id: r.id,
            reportNumber: r.report_number || `RPT-${r.id.substring(0, 8)}`,
            collectorName: r.collector_name || 'Collector',
            collectorEmail: r.collector_email,
            userId: r.user_id,
            afNo,
            orRange,
            orCount,
            orNumbers,
            itemIds,
            collectionType,
            totalAmount: parseFloat(r.total_collection || 0),
            subCategorySummary,
            submittedAt: r.created_at || new Date().toISOString(),
            submittedBy: isStructured && colData.submittedBy ? colData.submittedBy : 'Administrator',
            status: r.status || 'Submitted',
            dateFrom: isStructured && colData.dateFrom ? colData.dateFrom : (r.date || ''),
            dateTo: isStructured && colData.dateTo ? colData.dateTo : (r.date || '')
          };
        });

        // Merge local and remote, keyed strictly by reportNumber so NO duplicate rows ever appear
        const mergedMap = new Map<string, AdminSubmittedReportRecord>();

        // 1. Add remote reports first
        remoteReports.forEach(r => {
          const key = (r.reportNumber || r.id).trim().toUpperCase();
          mergedMap.set(key, r);
        });

        // 2. Overlay localStored (prefer local's richer metadata if available, but retain remote ID if valid uuid)
        localStored.forEach(l => {
          const key = (l.reportNumber || l.id).trim().toUpperCase();
          const remote = mergedMap.get(key);
          if (remote) {
            mergedMap.set(key, {
              ...remote,
              ...l,
              id: isValidUuid(remote.id) ? remote.id : l.id,
              afNo: l.afNo || remote.afNo,
              orRange: l.orRange || remote.orRange,
              orNumbers: l.orNumbers?.length ? l.orNumbers : remote.orNumbers,
              orCount: l.orCount || remote.orCount,
              subCategorySummary: l.subCategorySummary?.length ? l.subCategorySummary : remote.subCategorySummary
            });
          } else {
            mergedMap.set(key, l);
          }
        });

        return Array.from(mergedMap.values()).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
      }
    } catch (e) {
      console.warn('Error fetching submitted reports from Supabase:', e);
    }
  }

  return localStored.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
};

export const getSubmittedItemIds = async (): Promise<Set<string>> => {
  const submittedSet = new Set<string>();

  // 1. Check localStorage tracking
  const localItemKeys: string[] = JSON.parse(localStorage.getItem('rcd_submitted_item_keys') || '[]');
  localItemKeys.forEach(k => submittedSet.add(k));

  // 2. Check submitted reports
  const submittedReports = await getAdminSubmittedReports();
  submittedReports.forEach(report => {
    report.itemIds.forEach(id => {
      submittedSet.add(`${report.collectionType}_${id}`);
    });
    report.orNumbers.forEach(or => {
      if (or) submittedSet.add(`or_${report.afNo}_${or}`);
    });
  });

  return submittedSet;
};

export const saveAdminSubmittedReport = async (
  record: AdminSubmittedReportRecord
): Promise<boolean> => {
  const user = getCurrentLocalUser();

  // 1. Save to local storage (deduplicated by reportNumber and id)
  const current: AdminSubmittedReportRecord[] = JSON.parse(
    localStorage.getItem('rcd_admin_submitted_reports') || '[]'
  );
  const updated = [
    record, 
    ...current.filter(r => r.id !== record.id && r.reportNumber !== record.reportNumber)
  ];
  localStorage.setItem('rcd_admin_submitted_reports', JSON.stringify(updated));

  // 2. Update submitted item keys in local storage
  const currentKeys: string[] = JSON.parse(localStorage.getItem('rcd_submitted_item_keys') || '[]');
  const newKeys = new Set(currentKeys);
  record.itemIds.forEach(id => newKeys.add(`${record.collectionType}_${id}`));
  record.orNumbers.forEach(or => {
    if (or) newKeys.add(`or_${record.afNo}_${or}`);
  });
  localStorage.setItem('rcd_submitted_item_keys', JSON.stringify(Array.from(newKeys)));

  // 3. Sync to Supabase rcd_reports table
  if (isSupabaseConfigured()) {
    try {
      const fundType = record.collectionType === 'rpt' ? 'SEF' : 'General Fund';
      
      const reportPayload = {
        subCategories: record.subCategorySummary,
        afNo: record.afNo,
        orRange: record.orRange,
        orNumbers: record.orNumbers,
        orCount: record.orCount,
        itemIds: record.itemIds,
        collectionType: record.collectionType,
        dateFrom: record.dateFrom,
        dateTo: record.dateTo,
        submittedBy: record.submittedBy
      };

      await supabase
        .from('rcd_reports')
        .insert({
          user_id: isValidUuid(record.userId) ? record.userId : (isValidUuid(user?.id) ? user.id : null),
          collector_email: record.collectorEmail || user?.email || null,
          report_number: record.reportNumber,
          date: record.dateTo || new Date().toISOString().split('T')[0],
          collector_name: record.collectorName,
          fund_type: fundType,
          collections: reportPayload,
          total_collection: record.totalAmount,
          deposits: [],
          total_deposit: 0,
          status: 'Submitted'
        });

      // Try updating status column in rcd_collections / rcd_rpt_collections if exists
      const table = record.collectionType === 'rpt' ? 'rcd_rpt_collections' : 'rcd_collections';
      try {
        await supabase
          .from(table)
          .update({ status: 'Submitted' })
          .in('id', record.itemIds);
      } catch {}
    } catch (e) {
      console.warn('Error saving submitted report to Supabase:', e);
    }
  }

  return true;
};

export const unmarkAdminSubmittedReport = async (
  reportId: string,
  itemIds: number[],
  collectionType: 'general' | 'rpt',
  afNo?: string,
  orNumbers?: string[]
): Promise<boolean> => {
  // 1. Remove from local storage reports
  const current: AdminSubmittedReportRecord[] = JSON.parse(
    localStorage.getItem('rcd_admin_submitted_reports') || '[]'
  );
  const targetReport = current.find(r => r.id === reportId);
  const targetReportNumber = targetReport?.reportNumber;

  const updated = current.filter(r => r.id !== reportId && (!targetReportNumber || r.reportNumber !== targetReportNumber));
  localStorage.setItem('rcd_admin_submitted_reports', JSON.stringify(updated));

  // 2. Remove from submitted item keys
  const currentKeys: string[] = JSON.parse(localStorage.getItem('rcd_submitted_item_keys') || '[]');
  const keysToRemove = new Set<string>();
  itemIds.forEach(id => keysToRemove.add(`${collectionType}_${id}`));
  if (orNumbers && afNo) {
    orNumbers.forEach(or => keysToRemove.add(`or_${afNo}_${or}`));
  }
  const filteredKeys = currentKeys.filter(k => !keysToRemove.has(k));
  localStorage.setItem('rcd_submitted_item_keys', JSON.stringify(filteredKeys));

  // 3. Update Supabase
  if (isSupabaseConfigured()) {
    try {
      if (isValidUuid(reportId)) {
        await supabase
          .from('rcd_reports')
          .delete()
          .eq('id', reportId);
      } else if (targetReportNumber) {
        await supabase
          .from('rcd_reports')
          .delete()
          .eq('report_number', targetReportNumber);
      }

      const table = collectionType === 'rpt' ? 'rcd_rpt_collections' : 'rcd_collections';
      try {
        await supabase
          .from(table)
          .update({ status: 'Pending' })
          .in('id', itemIds);
      } catch {}
    } catch (e) {
      console.warn('Error unmarking report in Supabase:', e);
    }
  }

  return true;
};


