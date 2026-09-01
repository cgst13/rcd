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
  Chip 
} from '@mui/material';
import { Edit, Refresh, Clear, Save, People } from '@mui/icons-material';
import { Notification } from '../components/Notification';
import { getOfficialSignatories, saveSignatory } from '../services/supabaseService';
import type { Signatory } from '../types/rcd';

export const SignatoriesPage: React.FC = () => {
  const [signatories, setSignatories] = useState<Signatory[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);

  // Notification State
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'success'
  });

  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    position: '',
    department: '',
    remarks: ''
  });

  const getSignatoryRoleLabel = (signatory: Signatory) => {
    if (signatory.position.toLowerCase().includes('municipal treasurer') || signatory.remarks?.toLowerCase().includes('verification')) {
      return { 
        title: 'Section D: Verification & Acknowledgment', 
        role: 'Municipal Treasurer',
        color: '#047857', 
        bgcolor: '#d1fae5' 
      };
    }
    if (signatory.remarks?.toLowerCase().includes('prepared') || signatory.position.toLowerCase().includes('aa') || signatory.position.toLowerCase().includes('staff')) {
      return { 
        title: 'Section E: Prepared by', 
        role: 'Accounting Staff',
        color: '#b45309', 
        bgcolor: '#fef3c7' 
      };
    }
    return { 
      title: 'Section E: Certified Correct', 
      role: 'Municipal Accountant',
      color: '#6d28d9', 
      bgcolor: '#ede9fe' 
    };
  };

  const loadSignatories = async () => {
    setLoading(true);
    try {
      const data = await getOfficialSignatories();
      setSignatories(data);
    } catch (error) {
      console.error('Failed to load official signatories', error);
      setNotification({
        open: true,
        message: 'Failed to load signatories from database.',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSignatories();
  }, []);

  const handleEdit = (signatory: Signatory) => {
    setFormData({
      fullName: signatory.fullName,
      position: signatory.position,
      department: signatory.department,
      remarks: signatory.remarks || ''
    });
    setCurrentId(signatory.id);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleSave = async () => {
    if (!currentId) return;
    setLoading(true);
    try {
      const signatory: Signatory = {
        id: currentId,
        fullName: formData.fullName.trim().toUpperCase(),
        position: formData.position.trim(),
        department: formData.department.trim(),
        remarks: formData.remarks.trim()
      };
      
      await saveSignatory(signatory);
      await loadSignatories();
      handleClose();
      setNotification({
        open: true,
        message: 'Signatory updated and synced to database successfully!',
        severity: 'success'
      });
    } catch (error) {
      console.error('Failed to save signatory', error);
      setNotification({
        open: true,
        message: 'Failed to update signatory.',
        severity: 'error'
      });
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
            Designated municipal officials for official RCD and RPT report certification.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Tooltip title="Refresh Signatories" arrow>
            <IconButton color="primary" onClick={loadSignatories} disabled={loading}>
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Informative Banner */}
      <Paper elevation={0} sx={{ p: 2, mb: 3, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
        <People sx={{ color: '#16a34a', fontSize: 28 }} />
        <Box>
          <Typography variant="subtitle2" fontWeight="700" sx={{ color: '#15803d' }}>
            Official Report Signatories (3 Designated Roles)
          </Typography>
          <Typography variant="body2" sx={{ color: '#166534', fontSize: '0.84rem' }}>
            These 3 designated official municipal signatories appear across all official RCD and RPT reports. All authorized users can edit and update these records when officials change. Adding or deleting roles is locked to preserve standardized report templates.
          </Typography>
        </Box>
      </Paper>

      {/* Table */}
      <Paper elevation={0} sx={{ width: '100%', overflow: 'hidden', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
        <Box sx={{ p: 2, px: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#0369a1' }}>
            Designated Municipal Officials
          </Typography>
          <Typography variant="caption" color="text.secondary" fontWeight="700">
            {signatories.length} Official Roles
          </Typography>
        </Box>

        <TableContainer className="table-responsive">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Report Role & Section</TableCell>
                <TableCell>Full Name</TableCell>
                <TableCell>Position / Title</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Designation</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {signatories.map((row) => {
                const roleMeta = getSignatoryRoleLabel(row);

                return (
                  <TableRow key={row.id} hover>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight="700" sx={{ color: '#0f172a' }}>
                          {roleMeta.title}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                          {row.remarks || roleMeta.role}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#0f172a' }}>{row.fullName}</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#0284c7' }}>{row.position}</TableCell>
                    <TableCell>{row.department}</TableCell>
                    <TableCell>
                      <Chip 
                        label={roleMeta.role} 
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
                      <Tooltip title="Edit Signatory" arrow>
                        <IconButton size="small" color="primary" onClick={() => handleEdit(row)}>
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
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

      {/* Edit Dialog */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 1.5, border: '1px solid #e2e8f0' } }}>
        <DialogTitle component="div" sx={{ bgcolor: '#f8fafc', color: '#0369a1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderBottom: '1px solid #e2e8f0' }}>
          <Typography component="div" variant="h6" fontWeight="800">
            Edit Authorized Signatory
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
              Update the name, position, and office of this official municipal signatory. Changes are synchronized to the Supabase database and apply to all generated reports.
            </Typography>
          </Box>
          <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Full Name (e.g. MENARD A. HERRERA)"
                fullWidth
                size="small"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Position / Designation (e.g. Municipal Treasurer)"
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
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Remarks / Report Role"
                fullWidth
                size="small"
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
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
          <Tooltip title="Save Changes" arrow>
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

      <Notification
        open={notification.open}
        message={notification.message}
        severity={notification.severity}
        onClose={() => setNotification(prev => ({ ...prev, open: false }))}
      />
    </Box>
  );
};
