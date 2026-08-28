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
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  TextField, 
  Grid, 
  CircularProgress, 
  Backdrop,
  Tooltip,
  Stack,
  Chip
} from '@mui/material';
import { Add, Edit, Delete, Refresh, Clear, Save, People, Lock, AdminPanelSettings, Person } from '@mui/icons-material';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { getSignatories, saveSignatory, deleteSignatory } from '../services/supabaseService';
import { useAuth } from '../context/useAuth';
import type { Signatory } from '../types/rcd';

export const SignatoriesPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'administrator';

  const [signatories, setSignatories] = useState<Signatory[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);

  // Delete Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    position: '',
    department: '',
    remarks: ''
  });

  const isCertificationSignatory = (signatory: Signatory) => {
    return (
      signatory.id === 1 ||
      signatory.remarks?.toLowerCase().includes('certification') ||
      (signatory.department?.toLowerCase().includes('treasurer') && !signatory.position?.toLowerCase().includes('municipal treasurer'))
    );
  };

  const getSignatoryRoleLabel = (signatory: Signatory) => {
    if (isCertificationSignatory(signatory)) {
      return { title: 'Section D: Certification', scope: 'Collector (Personal)', color: '#0284c7', bgcolor: '#e0f2fe' };
    }
    if (signatory.position.toLowerCase().includes('municipal treasurer') || signatory.remarks?.toLowerCase().includes('verification')) {
      return { title: 'Section D: Verification & Acknowledgment', scope: 'Municipal Treasurer (Global)', color: '#047857', bgcolor: '#d1fae5' };
    }
    if (signatory.remarks?.toLowerCase().includes('prepared') || signatory.position.toLowerCase().includes('aa')) {
      return { title: 'Section E: Prepared by', scope: 'Accounting Staff (Global)', color: '#b45309', bgcolor: '#fef3c7' };
    }
    return { title: 'Section E: Certified Correct', scope: 'Municipal Accountant (Global)', color: '#6d28d9', bgcolor: '#ede9fe' };
  };

  const loadSignatories = async () => {
    setLoading(true);
    try {
      const data = await getSignatories();
      setSignatories(data);
    } catch (error) {
      console.error('Failed to load signatories', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSignatories();
  }, []);

  const handleOpen = () => {
    setFormData({
      fullName: '',
      position: '',
      department: '',
      remarks: ''
    });
    setIsEditing(false);
    setOpen(true);
  };

  const handleEdit = (signatory: Signatory) => {
    setFormData({
      fullName: signatory.fullName,
      position: signatory.position,
      department: signatory.department,
      remarks: signatory.remarks || ''
    });
    setCurrentId(signatory.id);
    setIsEditing(true);
    setOpen(true);
  };

  const handleDeleteClick = (id: number) => {
    setItemToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (itemToDelete) {
      setLoading(true);
      try {
        await deleteSignatory(itemToDelete);
        await loadSignatories();
      } catch (error) {
        console.error('Failed to delete signatory', error);
      } finally {
        setLoading(false);
        setDeleteDialogOpen(false);
        setItemToDelete(null);
      }
    }
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const signatory: Signatory = {
        id: isEditing && currentId ? currentId : Date.now(),
        ...formData
      };
      
      await saveSignatory(signatory);
      await loadSignatories();
      handleClose();
    } catch (error) {
      console.error('Failed to save signatory', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ width: '100%', pb: 6 }}>
      <Backdrop open={loading} sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <CircularProgress color="inherit" />
      </Backdrop>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" component="h1" fontWeight="800" sx={{ color: '#0f172a' }}>
            Authorized Signatories
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Designated municipal officials and collector certifying signatures for RCD reports.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Tooltip title="Refresh Signatories" arrow>
            <IconButton color="primary" onClick={loadSignatories} disabled={loading}>
              <Refresh />
            </IconButton>
          </Tooltip>
          {isAdmin && (
            <Tooltip title="Add Signatory" arrow>
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
          )}
        </Box>
      </Box>

      {/* Informative Scope Banner */}
      {!isAdmin ? (
        <Paper elevation={0} sx={{ p: 2, mb: 3, bgcolor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Person sx={{ color: '#0284c7', fontSize: 26 }} />
          <Box>
            <Typography variant="subtitle2" fontWeight="700" sx={{ color: '#0369a1' }}>
              Collector Certification & Shared Municipal Signatories
            </Typography>
            <Typography variant="body2" sx={{ color: '#0c4a6e', fontSize: '0.84rem' }}>
              You can edit your personal <strong>Certification</strong> signatory below. The <strong>Municipal Treasurer</strong>, <strong>Accounting Staff</strong>, and <strong>Municipal Accountant</strong> are officially designated and managed by the Administrator.
            </Typography>
          </Box>
        </Paper>
      ) : (
        <Paper elevation={0} sx={{ p: 2, mb: 3, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
          <AdminPanelSettings sx={{ color: '#0284c7', fontSize: 26 }} />
          <Box>
            <Typography variant="subtitle2" fontWeight="700" sx={{ color: '#0f172a' }}>
              Administrator Signatory Administration
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.84rem' }}>
              Modifications to <strong>Municipal Treasurer</strong>, <strong>Accounting Staff</strong>, and <strong>Municipal Accountant</strong> apply globally to all collectors' reports.
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Table */}
      <Paper elevation={0} sx={{ width: '100%', overflow: 'hidden', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
        <Box sx={{ p: 2, px: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#0369a1' }}>
            Official Report Signatory Hierarchy
          </Typography>
          <Typography variant="caption" color="text.secondary" fontWeight="700">
            {signatories.length} Signatories Configured
          </Typography>
        </Box>

        <TableContainer className="table-responsive">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Report Role & Section</TableCell>
                <TableCell>Full Name</TableCell>
                <TableCell>Position</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Scope</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {signatories.map((row) => {
                const isCert = isCertificationSignatory(row);
                const roleMeta = getSignatoryRoleLabel(row);
                const canEdit = isCert || isAdmin;

                return (
                  <TableRow key={row.id} hover sx={{ bgcolor: isCert && !isAdmin ? '#f0f9ff40' : 'inherit' }}>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight="700" sx={{ color: '#0f172a' }}>
                          {roleMeta.title}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                          {row.remarks || 'Standard Signatory'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#0f172a' }}>{row.fullName}</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#0284c7' }}>{row.position}</TableCell>
                    <TableCell>{row.department}</TableCell>
                    <TableCell>
                      <Chip 
                        label={isCert ? 'Personal (Collector)' : 'Global Official'} 
                        size="small" 
                        sx={{ 
                          fontWeight: 700, 
                          bgcolor: roleMeta.bgcolor, 
                          color: roleMeta.color,
                          borderRadius: 1
                        }} 
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                        {canEdit ? (
                          <Tooltip title={isCert ? "Edit Your Certification Signature" : "Edit Official Signatory (Global)"} arrow>
                            <IconButton size="small" color="primary" onClick={() => handleEdit(row)}>
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Tooltip title="Managed by Administrator (Shared by all users)" arrow>
                            <span>
                              <IconButton size="small" disabled sx={{ color: '#94a3b8' }}>
                                <Lock fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
                        {isAdmin && row.id > 4 && (
                          <Tooltip title="Delete Signatory" arrow>
                            <IconButton size="small" color="error" onClick={() => handleDeleteClick(row.id)}>
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
              {signatories.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                      <People sx={{ color: '#94a3b8', fontSize: 40 }} />
                      <Typography color="text.secondary" variant="body1" fontWeight="600">
                        No signatories found.
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Dialog */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 1.5, border: '1px solid #e2e8f0' } }}>
        <DialogTitle component="div" sx={{ bgcolor: '#f8fafc', color: '#0369a1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderBottom: '1px solid #e2e8f0' }}>
          <Typography component="div" variant="h6" fontWeight="800">
            {isEditing 
              ? (currentId === 1 || formData.remarks?.toLowerCase().includes('certification') 
                  ? 'Edit Your Certification Signature' 
                  : 'Edit Municipal Official Signatory')
              : 'Add New Signatory'}
          </Typography>
          <Tooltip title="Close" arrow>
            <IconButton onClick={handleClose} size="small" sx={{ borderRadius: 1 }}>
              <Clear />
            </IconButton>
          </Tooltip>
        </DialogTitle>
        <DialogContent sx={{ p: 3, pt: 3 }}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {currentId === 1 || formData.remarks?.toLowerCase().includes('certification')
                ? 'Update your name and designation as the certifying Revenue Collector on your RCD reports.'
                : 'This official signatory will apply globally across all collectors\' generated reports in the municipality.'}
            </Typography>
          </Box>
          <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Full Name (e.g. CHRISTIAN S. TOLENTINO)"
                fullWidth
                size="small"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Position / Designation (e.g. Revenue Collection Clerk I)"
                fullWidth
                size="small"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                required
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Department (e.g. Office of the Municipal Treasurer)"
                fullWidth
                size="small"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                required
              />
            </Grid>
            {isAdmin && (
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="Remarks / Section Role"
                  fullWidth
                  size="small"
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0', gap: 1.5 }}>
          <Tooltip title="Cancel" arrow>
            <IconButton onClick={handleClose} sx={{ bgcolor: '#e2e8f0', borderRadius: 1 }}>
              <Clear />
            </IconButton>
          </Tooltip>
          <Tooltip title={isEditing ? 'Save Changes' : 'Save Signatory'} arrow>
            <IconButton 
              onClick={handleSave} 
              disabled={!formData.fullName || !formData.position}
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
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Signatory"
        message="Are you sure you want to delete this signatory? This action cannot be undone."
        confirmText="Delete"
        severity="error"
      />
    </Box>
  );
};
