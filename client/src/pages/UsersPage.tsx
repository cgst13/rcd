import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  IconButton,
  Tooltip,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  TablePagination,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  InputAdornment,
  Avatar,
  Stack,
  Card,
  Autocomplete
} from '@mui/material';
import {
  PersonAdd,
  Edit,
  DeleteOutline,
  Search,
  Clear,
  Refresh,
  Save,
  SupervisorAccount,
  Badge,
  AdminPanelSettings,
  Person,
  CheckCircle,
  Group,
  VpnKey
} from '@mui/icons-material';
import { useAuth } from '../context/useAuth';
import { 
  getAllManagedUsers, 
  createManagedUser, 
  updateManagedUser, 
  deleteManagedUser,
  getLguDepartments,
  type ManagedUser,
  type LguDepartment 
} from '../services/supabaseService';
import { Notification } from '../components/Notification';
import { ConfirmDialog } from '../components/ConfirmDialog';

export const UsersPage: React.FC = () => {
  const { user: authUser } = useAuth();
  const isAdmin = authUser?.role?.toLowerCase() === 'admin' || authUser?.role?.toLowerCase() === 'administrator';

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('ALL');

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Dialog State
  const [openDialog, setOpenDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    firstName: string;
    lastName: string;
    email: string;
    department: string;
    position: string;
    role: string;
    password: string;
    status: 'Active' | 'Inactive';
  }>({
    firstName: '',
    lastName: '',
    email: '',
    department: '',
    position: '',
    role: 'user',
    password: '',
    status: 'Active'
  });

  // LGU Departments State
  const [lguDepartments, setLguDepartments] = useState<LguDepartment[]>([]);

  // Delete State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<ManagedUser | null>(null);

  // Notification State
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await getAllManagedUsers();
      setUsers(data);
    } catch (error) {
      console.error('Failed to load users', error);
      setNotification({
        open: true,
        message: 'Failed to load user profiles.',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    getLguDepartments().then(depts => setLguDepartments(depts)).catch(() => {});
  }, []);

  const handleOpenAdd = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      department: '',
      position: '',
      role: 'user',
      password: '',
      status: 'Active'
    });
    setIsEditing(false);
    setCurrentId(null);
    setOpenDialog(true);
  };

  const handleOpenEdit = (user: ManagedUser) => {
    setFormData({
      firstName: user.firstName || user.fullName.split(' ')[0] || '',
      lastName: user.lastName || user.fullName.split(' ').slice(1).join(' ') || '',
      email: user.email,
      department: user.department || '',
      position: user.position || '',
      role: user.role,
      password: '',
      status: (user.status as 'Active' | 'Inactive') || 'Active'
    });
    setIsEditing(true);
    setCurrentId(user.id);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleSave = async () => {
    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim()) {
      setNotification({
        open: true,
        message: 'Please provide first name, last name, and email address.',
        severity: 'warning'
      });
      return;
    }

    setLoading(true);
    try {
      if (isEditing && currentId) {
        const success = await updateManagedUser(currentId, {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          fullName: `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim(),
          email: formData.email.trim(),
          department: formData.department.trim(),
          position: formData.position.trim(),
          role: formData.role,
          status: formData.status,
          ...(formData.password.trim() ? { password: formData.password.trim() } : {})
        });
        if (success) {
          setNotification({
            open: true,
            message: `User ${formData.firstName} ${formData.lastName} updated successfully.`,
            severity: 'success'
          });
          setOpenDialog(false);
          await loadUsers();
        } else {
          setNotification({
            open: true,
            message: 'Failed to update user profile.',
            severity: 'error'
          });
        }
      } else {
        const created = await createManagedUser({
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          fullName: `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim(),
          email: formData.email.trim(),
          department: formData.department.trim(),
          position: formData.position.trim(),
          role: formData.role,
          password: formData.password.trim(),
          status: formData.status
        });
        if (created) {
          setNotification({
            open: true,
            message: `User ${created.fullName} created successfully in public.users.`,
            severity: 'success'
          });
          setOpenDialog(false);
          await loadUsers();
        } else {
          setNotification({
            open: true,
            message: 'Failed to create user account.',
            severity: 'error'
          });
        }
      }
    } catch (error) {
      console.error(error);
      setNotification({
        open: true,
        message: 'An unexpected error occurred.',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (user: ManagedUser) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setLoading(true);
    try {
      const success = await deleteManagedUser(userToDelete.id);
      if (success) {
        setNotification({
          open: true,
          message: `User ${userToDelete.fullName} removed successfully.`,
          severity: 'success'
        });
        await loadUsers();
      } else {
        setNotification({
          open: true,
          message: 'Failed to delete user.',
          severity: 'error'
        });
      }
    } catch (error) {
      console.error(error);
      setNotification({
        open: true,
        message: 'An unexpected error occurred during deletion.',
        severity: 'error'
      });
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = 
        u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.department && u.department.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.position && u.position.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesRole = 
        filterRole === 'ALL' || 
        (filterRole === 'admin' && (u.role.toLowerCase() === 'admin' || u.role.toLowerCase() === 'administrator')) ||
        (filterRole === 'user' && (u.role.toLowerCase() === 'user' || u.role.toLowerCase() === 'collector'));

      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, filterRole]);

  const adminCount = users.filter(u => u.role.toLowerCase() === 'admin' || u.role.toLowerCase() === 'administrator').length;
  const collectorCount = users.filter(u => u.role.toLowerCase() === 'user' || u.role.toLowerCase() === 'collector').length;

  if (!isAdmin) {
    return (
      <Box sx={{ width: '100%', py: 8, textAlign: 'center', maxWidth: 700, mx: 'auto' }}>
        <Paper elevation={0} sx={{ p: 4, borderRadius: 1.5, border: '1px solid #fee2e2', bgcolor: '#fef2f2' }}>
          <AdminPanelSettings sx={{ fontSize: 48, color: '#ef4444', mb: 2 }} />
          <Typography variant="h5" fontWeight="800" sx={{ color: '#991b1b', mb: 1 }}>
            Administrator Access Required
          </Typography>
          <Typography variant="body1" sx={{ color: '#7f1d1d' }}>
            User management and credential administration are restricted to authorized system administrators.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', pb: 6 }}>
      <Notification
        open={notification.open}
        message={notification.message}
        severity={notification.severity}
        onClose={() => setNotification(prev => ({ ...prev, open: false }))}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete User Account"
        message={userToDelete ? `Are you sure you want to remove user "${userToDelete.fullName}" (${userToDelete.email}) from public.users? This action cannot be undone.` : "Are you sure you want to delete this user?"}
        confirmText="Delete User"
        severity="error"
      />

      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="h4" component="h1" fontWeight="800" sx={{ color: '#0f172a' }}>
              User Management
            </Typography>
            <Chip 
              label="public.users Table" 
              size="small" 
              sx={{ fontWeight: 700, bgcolor: '#e0f2fe', color: '#0284c7', border: '1px solid rgba(14, 165, 233, 0.3)', borderRadius: 1 }} 
            />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Manage municipal revenue personnel, department assignments, and login credentials in the public.users database.
          </Typography>
        </Box>

        {/* Top Actions: Icons Only with Tooltip */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Tooltip title="Refresh Users" arrow>
            <IconButton 
              color="primary" 
              onClick={loadUsers} 
              sx={{ 
                bgcolor: '#f0f9ff', 
                p: 1.4, 
                border: '1px solid rgba(14, 165, 233, 0.2)',
                color: '#0284c7',
                '&:hover': { bgcolor: '#e0f2fe' }
              }}
            >
              <Refresh />
            </IconButton>
          </Tooltip>

          <Tooltip title="Add New User Profile" arrow>
            <IconButton 
              color="primary"
              onClick={handleOpenAdd}
              sx={{ 
                bgcolor: '#0284c7', 
                color: '#ffffff', 
                p: 1.4,
                borderRadius: 1,
                '&:hover': { bgcolor: '#0369a1', color: '#ffffff' } 
              }}
            >
              <PersonAdd />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* KPI Overview Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card elevation={0} sx={{ p: 2.5, borderRadius: 1.5, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="caption" fontWeight="700" color="text.secondary" textTransform="uppercase">
                  Total Users
                </Typography>
                <Typography variant="h4" fontWeight="800" sx={{ color: '#0369a1', mt: 0.5 }}>
                  {users.length}
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: '#0284c7', width: 44, height: 44, borderRadius: 1 }}>
                <Group />
              </Avatar>
            </Box>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card elevation={0} sx={{ p: 2.5, borderRadius: 1.5, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="caption" fontWeight="700" color="text.secondary" textTransform="uppercase">
                  Administrators
                </Typography>
                <Typography variant="h4" fontWeight="800" sx={{ color: '#0f172a', mt: 0.5 }}>
                  {adminCount}
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: '#0369a1', width: 44, height: 44, borderRadius: 1 }}>
                <AdminPanelSettings />
              </Avatar>
            </Box>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card elevation={0} sx={{ p: 2.5, borderRadius: 1.5, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="caption" fontWeight="700" color="text.secondary" textTransform="uppercase">
                  Revenue Collectors
                </Typography>
                <Typography variant="h4" fontWeight="800" sx={{ color: '#0f172a', mt: 0.5 }}>
                  {collectorCount}
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: '#0ea5e9', width: 44, height: 44, borderRadius: 1 }}>
                <Badge />
              </Avatar>
            </Box>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card elevation={0} sx={{ p: 2.5, borderRadius: 1.5, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="caption" fontWeight="700" sx={{ color: '#047857' }} textTransform="uppercase">
                  Active Status
                </Typography>
                <Typography variant="h4" fontWeight="800" sx={{ color: '#047857', mt: 0.5 }}>
                  {users.filter(u => u.status !== 'Inactive').length}
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: '#10b981', width: 44, height: 44, borderRadius: 1 }}>
                <CheckCircle />
              </Avatar>
            </Box>
          </Card>
        </Grid>
      </Grid>

      {/* Main Table */}
      <Paper elevation={0} sx={{ width: '100%', overflow: 'hidden', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
        {/* Search & Filter Toolbar */}
        <Box sx={{ p: 2, px: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', flexGrow: 1 }}>
            <Box sx={{ minWidth: 260, flexGrow: 1, maxWidth: 400 }}>
              <TextField
                placeholder="Search users by name, email, department, position..."
                size="small"
                fullWidth
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ color: '#94a3b8' }} fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Role Filter</InputLabel>
              <Select
                value={filterRole}
                label="Role Filter"
                onChange={(e) => setFilterRole(e.target.value)}
              >
                <MenuItem value="ALL">All Roles</MenuItem>
                <MenuItem value="admin">Administrators</MenuItem>
                <MenuItem value="user">Collectors</MenuItem>
              </Select>
            </FormControl>

            {(searchTerm || filterRole !== 'ALL') && (
              <Tooltip title="Clear Filters" arrow>
                <IconButton 
                  onClick={() => { setSearchTerm(''); setFilterRole('ALL'); }}
                  sx={{ bgcolor: '#ffffff', color: '#64748b', border: '1px solid #e2e8f0' }}
                >
                  <Clear fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>

          <Typography variant="caption" fontWeight="700" sx={{ color: '#0369a1' }}>
            {filteredUsers.length} Users Listed
          </Typography>
        </Box>

        <TableContainer sx={{ maxHeight: 600 }}>
          <Table stickyHeader>
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>User Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Position & Office</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Email Address</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>System Role</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Last Login / Created</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={32} />
                  </TableCell>
                </TableRow>
              ) : filteredUsers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((u) => {
                const userIsAdmin = u.role.toLowerCase() === 'admin' || u.role.toLowerCase() === 'administrator';
                return (
                  <TableRow key={u.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ bgcolor: userIsAdmin ? '#0284c7' : '#0ea5e9', width: 36, height: 36, fontSize: '0.88rem', fontWeight: 'bold' }}>
                          {u.fullName.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight="700" sx={{ color: '#0f172a' }}>
                            {u.fullName}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#64748b' }}>
                            ID: {u.id.substring(0, 8)}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="600" sx={{ color: '#1e293b' }}>
                        {u.position || 'Revenue Staff'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>
                        {u.department || 'Treasury Office'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#334155' }}>
                      {u.email}
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={userIsAdmin ? <AdminPanelSettings sx={{ fontSize: '16px !important' }} /> : <Person sx={{ fontSize: '16px !important' }} />}
                        label={userIsAdmin ? 'Administrator' : 'Collector'}
                        size="small"
                        sx={{
                          fontWeight: 700,
                          bgcolor: userIsAdmin ? '#eff6ff' : '#f0fdf4',
                          color: userIsAdmin ? '#1d4ed8' : '#15803d',
                          border: userIsAdmin ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(34, 197, 94, 0.3)'
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={u.status || 'Active'}
                        size="small"
                        sx={{
                          fontWeight: 700,
                          bgcolor: u.status === 'Inactive' ? '#fef2f2' : '#ecfdf5',
                          color: u.status === 'Inactive' ? '#b91c1c' : '#047857',
                          border: u.status === 'Inactive' ? '1px solid #fecaca' : '1px solid #a7f3d0'
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: '#64748b', fontSize: '0.85rem' }}>
                      {u.lastLogin ? (
                        <>
                          <Typography variant="caption" display="block" fontWeight="600" color="text.primary">
                            {new Date(u.lastLogin).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(u.lastLogin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Typography>
                        </>
                      ) : u.createdAt ? (
                        <Typography variant="caption" color="text.secondary">
                          Registered: {new Date(u.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </Typography>
                      ) : '-'}
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title={`Edit ${u.fullName}`} arrow>
                          <IconButton 
                            size="small" 
                            color="primary" 
                            onClick={() => handleOpenEdit(u)}
                            sx={{ bgcolor: '#f0f9ff', '&:hover': { bgcolor: '#e0f2fe' } }}
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={`Delete ${u.fullName}`} arrow>
                          <IconButton 
                            size="small" 
                            color="error" 
                            onClick={() => handleDeleteClick(u)}
                            disabled={authUser?.email === u.email}
                            sx={{ bgcolor: '#fef2f2', '&:hover': { bgcolor: '#fee2e2' } }}
                          >
                            <DeleteOutline fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredUsers.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <SupervisorAccount sx={{ color: '#94a3b8', fontSize: 44, mb: 1 }} />
                    <Typography color="text.secondary" fontWeight="600">
                      No user accounts found matching current search.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[10, 25, 50]}
          component="div"
          count={filteredUsers.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          labelRowsPerPage="Users per page:"
        />
      </Paper>

      {/* Add / Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', p: 2.5 }}>
          <Box sx={{ width: 36, height: 36, bgcolor: '#0284c7', color: '#ffffff', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isEditing ? <Edit /> : <PersonAdd />}
          </Box>
          <Box>
            <Typography variant="h6" fontWeight="800" sx={{ color: '#0f172a', lineHeight: 1.2 }}>
              {isEditing ? 'Edit User Profile' : 'Add New User Profile'}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              {isEditing ? 'Modify user credentials and privileges in public.users' : 'Register a new municipal revenue collector or admin in public.users'}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 3, pt: 3.5 }}>
          <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="First Name"
                fullWidth
                size="small"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                placeholder="e.g. Maria"
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Last Name"
                fullWidth
                size="small"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                placeholder="e.g. Santos"
                required
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Email Address"
                type="email"
                fullWidth
                size="small"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="e.g. maria.santos@rcd.gov.ph"
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Autocomplete
                freeSolo
                size="small"
                options={lguDepartments.map(d => d.departmentName)}
                value={formData.department}
                onInputChange={(_, newInputValue) => {
                  setFormData({ ...formData, department: newInputValue });
                }}
                onChange={(_, newValue) => {
                  setFormData({ ...formData, department: newValue || '' });
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Department / Office"
                    placeholder="e.g. Municipal Treasurer Office"
                    helperText="Only Municipal Treasurer Office users can sign in"
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Position / Title"
                fullWidth
                size="small"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                placeholder="e.g. Revenue Collection Clerk II"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Role</InputLabel>
                <Select
                  value={formData.role}
                  label="Role"
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  <MenuItem value="user">Revenue Collector (User)</MenuItem>
                  <MenuItem value="admin">System Administrator</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Account Status</InputLabel>
                <Select
                  value={formData.status}
                  label="Account Status"
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'Active' | 'Inactive' })}
                >
                  <MenuItem value="Active">Active</MenuItem>
                  <MenuItem value="Inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                label={isEditing ? "Password (leave blank to keep current)" : "Default Login Password"}
                type="password"
                fullWidth
                size="small"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={isEditing ? "Enter new password if updating" : "Set initial login password"}
                required={!isEditing}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <VpnKey fontSize="small" sx={{ color: '#0284c7' }} />
                      </InputAdornment>
                    ),
                  }
                }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, bgcolor: '#f8fafc', borderTop: '1px solid rgba(14, 165, 233, 0.08)', gap: 1.5 }}>
          {/* User Icons Only with Tooltip */}
          <Tooltip title="Cancel" arrow>
            <IconButton onClick={handleCloseDialog} sx={{ bgcolor: '#e2e8f0', color: '#64748b' }}>
              <Clear />
            </IconButton>
          </Tooltip>
          <Tooltip title={isEditing ? 'Update User' : 'Save User'} arrow>
            <IconButton
              onClick={handleSave}
              disabled={loading || !formData.firstName || !formData.lastName || !formData.email || (!isEditing && !formData.password)}
              sx={{
                bgcolor: '#0284c7',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
                '&:hover': { bgcolor: '#0369a1', color: '#ffffff' }
              }}
            >
              <Save />
            </IconButton>
          </Tooltip>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
