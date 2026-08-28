import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  IconButton, 
  Chip, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  TextField, 
  Grid, 
  CircularProgress, 
  Backdrop, 
  Autocomplete,
  Tooltip,
  Stack
} from '@mui/material';
import { Add, Edit, Delete, Refresh, Clear, Save, ListAlt } from '@mui/icons-material';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { getAccountCodes, saveAccountCode, deleteAccountCode } from '../services/supabaseService';
import type { AccountCode } from '../types/rcd';

export const AccountCodesPage: React.FC = () => {
  const [accountCodes, setAccountCodes] = useState<AccountCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);

  // Delete Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    mainCategory: '',
    subCategory: '',
    code: ''
  });

  const uniqueMainCategories = Array.from(new Set(accountCodes.map(c => c.mainCategory))).filter(Boolean).sort();

  const getCommonPrefix = (category: string, codes: AccountCode[]) => {
    const categoryCodes = codes
      .filter(c => c.mainCategory === category)
      .map(c => c.code)
      .filter(Boolean);

    if (categoryCodes.length === 0) return '';

    const sortedCodes = categoryCodes.sort();
    const first = sortedCodes[0];
    const last = sortedCodes[sortedCodes.length - 1];
    let i = 0;
    while (i < first.length && first.charAt(i) === last.charAt(i)) {
      i++;
    }
    return first.substring(0, i);
  };

  const loadAccountCodes = async () => {
    setLoading(true);
    try {
      const codes = await getAccountCodes();
      setAccountCodes(codes);
    } catch (error) {
      console.error('Failed to load account codes', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccountCodes();
  }, []);

  const handleOpen = () => {
    setFormData({
      mainCategory: '',
      subCategory: '',
      code: ''
    });
    setIsEditing(false);
    setOpen(true);
  };

  const handleEdit = (code: AccountCode) => {
    setFormData({
      mainCategory: code.mainCategory,
      subCategory: code.subCategory,
      code: code.code
    });
    setCurrentId(code.id);
    setIsEditing(true);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const confirmDelete = (id: number) => {
    setItemToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (itemToDelete === null) return;
    
    setLoading(true);
    try {
      await deleteAccountCode(itemToDelete);
      await loadAccountCodes();
    } catch (error) {
      console.error('Failed to delete', error);
    } finally {
      setLoading(false);
      setItemToDelete(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const id = isEditing && currentId !== null 
        ? currentId 
        : (accountCodes.length > 0 ? Math.max(...accountCodes.map(item => item.id)) + 1 : 1);
        
      const codeToSave: AccountCode = {
        id,
        ...formData
      };
      
      await saveAccountCode(codeToSave);
      await loadAccountCodes();
      handleClose();
    } catch (error) {
      console.error('Error saving account code:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Backdrop open={loading} sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <CircularProgress color="inherit" />
      </Backdrop>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3.5, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" component="h1" fontWeight="800" sx={{ color: '#0f172a' }}>
            Account Codes
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Chart of revenue accounts, sub-categories, and general classifications.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Tooltip title="Refresh Codes" arrow>
            <IconButton color="primary" onClick={loadAccountCodes} disabled={loading}>
              <Refresh />
            </IconButton>
          </Tooltip>
          <Tooltip title="Add Account Code" arrow>
            <IconButton 
              color="primary" 
              onClick={handleOpen}
              sx={{ 
                bgcolor: '#0284c7', 
                color: '#ffffff', 
                borderRadius: 1,
                '&:hover': { bgcolor: '#0369a1', color: '#ffffff' } 
              }}
            >
              <Add />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Paper elevation={0} sx={{ width: '100%', overflow: 'hidden', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
        <Box sx={{ p: 2, px: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#0369a1' }}>
              Standard Chart of Accounts
            </Typography>
            <Chip 
              label="Universal Source" 
              size="small" 
              sx={{ fontSize: '0.72rem', height: 20, bgcolor: '#e0f2fe', color: '#0369a1', fontWeight: 700 }} 
            />
          </Box>
          <Typography variant="caption" color="text.secondary" fontWeight="700">
            {accountCodes.length} Codes Available
          </Typography>
        </Box>

        <TableContainer className="table-responsive">
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Sub Category</TableCell>
                <TableCell>Main Category</TableCell>
                <TableCell>Account Code</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {accountCodes.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell sx={{ color: '#64748b', fontWeight: 600 }}>#{row.id}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{row.subCategory}</TableCell>
                  <TableCell>
                    <Chip 
                      label={row.mainCategory} 
                      size="small" 
                      sx={{
                        fontWeight: 700,
                        bgcolor: '#e0f2fe',
                        color: '#0369a1',
                        borderRadius: 1
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>{row.code}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Tooltip title="Edit Code" arrow>
                        <IconButton size="small" color="primary" onClick={() => handleEdit(row)}>
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Code" arrow>
                        <IconButton size="small" color="error" onClick={() => confirmDelete(row.id)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {accountCodes.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                      <ListAlt sx={{ color: '#94a3b8', fontSize: 40 }} />
                      <Typography color="text.secondary" variant="body1" fontWeight="600">
                        No account codes configured yet.
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 1.5, border: '1px solid #e2e8f0' } }}>
        <form onSubmit={handleSubmit}>
          <DialogTitle component="div" sx={{ bgcolor: '#f8fafc', color: '#0369a1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderBottom: '1px solid #e2e8f0' }}>
            <Typography component="div" variant="h6" fontWeight="800">
              {isEditing ? 'Edit Account Code' : 'Add Account Code'}
            </Typography>
            <Tooltip title="Close" arrow>
              <IconButton onClick={handleClose} size="small" sx={{ borderRadius: 1 }}>
                <Clear />
              </IconButton>
            </Tooltip>
          </DialogTitle>
          <DialogContent sx={{ p: 3, pt: 3 }}>
            <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Sub Category"
                  value={formData.subCategory}
                  onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
                  placeholder="e.g. Community Tax - Individual"
                  required
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Autocomplete
                  freeSolo
                  options={uniqueMainCategories}
                  value={formData.mainCategory}
                  onChange={(_, newValue) => {
                    const category = newValue || '';
                    const prefix = getCommonPrefix(category, accountCodes);
                    setFormData({ 
                      ...formData, 
                      mainCategory: category,
                      code: prefix
                    });
                  }}
                  onInputChange={(_, newInputValue) => {
                    setFormData({ ...formData, mainCategory: newInputValue });
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      fullWidth
                      size="small"
                      label="Main Category"
                      placeholder="e.g. Tax Revenue"
                      required
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Account Code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g. 4-01-01-050"
                  required
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 2, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0', gap: 1.5 }}>
            <Tooltip title="Cancel" arrow>
              <IconButton onClick={handleClose} sx={{ bgcolor: '#e2e8f0', borderRadius: 1 }}>
                <Clear />
              </IconButton>
            </Tooltip>
            <Tooltip title={isEditing ? 'Save Changes' : 'Add Code'} arrow>
              <IconButton 
                type="submit" 
                color="primary" 
                disabled={loading}
                sx={{ 
                  bgcolor: '#0284c7', 
                  color: '#ffffff',
                  borderRadius: 1,
                  '&:hover': { bgcolor: '#0369a1', color: '#ffffff' }
                }}
              >
                <Save />
              </IconButton>
            </Tooltip>
          </DialogActions>
        </form>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Delete Account Code"
        message="Are you sure you want to delete this account code? This action cannot be undone."
        confirmText="Delete"
        severity="error"
      />
    </Box>
  );
};
