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
  Button, 
  IconButton, 
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  CircularProgress,
  Backdrop
} from '@mui/material';
import { Add, Edit, Delete, Refresh } from '@mui/icons-material';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { getSignatories, saveSignatory, deleteSignatory } from '../services/googleSheets';
import type { Signatory } from '../types/rcd';

export const SignatoriesPage: React.FC = () => {
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
        id: isEditing && currentId ? currentId : Date.now(), // Use timestamp for ID if new
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
    <Box sx={{ p: 3 }}>
        <Backdrop open={loading} sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}>
            <CircularProgress color="inherit" />
        </Backdrop>

        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h4" component="h1">
                Signatories
            </Typography>
            <Box>
                <Button 
                    startIcon={<Refresh />} 
                    onClick={loadSignatories} 
                    sx={{ mr: 1 }}
                >
                    Refresh
                </Button>
                <Button 
                    variant="contained" 
                    startIcon={<Add />} 
                    onClick={handleOpen}
                >
                    Add Signatory
                </Button>
            </Box>
        </Box>

        <TableContainer component={Paper}>
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell>ID</TableCell>
                        <TableCell>Full Name</TableCell>
                        <TableCell>Position</TableCell>
                        <TableCell>Department</TableCell>
                        <TableCell>Remarks</TableCell>
                        <TableCell align="right">Actions</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {signatories.map((row) => (
                        <TableRow key={row.id}>
                            <TableCell>{row.id}</TableCell>
                            <TableCell>{row.fullName}</TableCell>
                            <TableCell>{row.position}</TableCell>
                            <TableCell>{row.department}</TableCell>
                            <TableCell>{row.remarks}</TableCell>
                            <TableCell align="right">
                                <IconButton color="primary" onClick={() => handleEdit(row)}>
                                    <Edit />
                                </IconButton>
                                <IconButton color="error" onClick={() => handleDeleteClick(row.id)}>
                                    <Delete />
                                </IconButton>
                            </TableCell>
                        </TableRow>
                    ))}
                    {signatories.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={6} align="center">
                                No signatories found
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </TableContainer>

        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>{isEditing ? 'Edit Signatory' : 'Add New Signatory'}</DialogTitle>
            <DialogContent>
                <Grid container spacing={2} sx={{ mt: 1 }}>
                    <Grid size={{ xs: 12 }}>
                        <TextField
                            label="Full Name"
                            fullWidth
                            value={formData.fullName}
                            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                            required
                        />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <TextField
                            label="Position"
                            fullWidth
                            value={formData.position}
                            onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                            required
                        />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <TextField
                            label="Department"
                            fullWidth
                            value={formData.department}
                            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                            required
                        />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <TextField
                            label="Remarks"
                            fullWidth
                            multiline
                            rows={2}
                            value={formData.remarks}
                            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                        />
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Cancel</Button>
                <Button onClick={handleSave} variant="contained" disabled={!formData.fullName || !formData.position}>
                    Save
                </Button>
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
