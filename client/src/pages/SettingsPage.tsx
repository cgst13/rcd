import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  List, 
  ListItem, 
  ListItemText, 
  ListItemIcon, 
  ListItemButton, 
  Switch, 
  Divider, 
  Avatar, 
  IconButton, 
  Tooltip, 
  Chip
} from '@mui/material';
import { 
  Notifications, 
  DarkMode, 
  Language, 
  Security, 
  CloudDownload, 
  DeleteForever, 
  Info
} from '@mui/icons-material';
import { useAuth } from '../context/useAuth';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Notification } from '../components/Notification';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [openClearDialog, setOpenClearDialog] = useState(false);
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({ open: false, message: '', severity: 'info' });

  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'administrator';

  const handleExportData = () => {
    const data = localStorage.getItem('rcd_reports');
    if (!data) {
      setNotification({ open: true, message: 'No local reports data to export.', severity: 'warning' });
      return;
    }
    
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rcd_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setNotification({ open: true, message: 'Data exported successfully.', severity: 'success' });
  };

  const handleClearData = () => {
    localStorage.removeItem('rcd_reports');
    setOpenClearDialog(false);
    setNotification({ open: true, message: 'Local cache cleared successfully.', severity: 'success' });
  };

  return (
    <Box sx={{ width: '100%', pb: 6 }}>
      <Box sx={{ mb: 3.5 }}>
        <Typography variant="h4" component="h1" fontWeight="800" sx={{ color: '#0f172a' }}>
          Settings & Preferences
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Manage your account profile, preferences, and data storage.
        </Typography>
      </Box>

      {/* Profile Section Card */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, display: 'flex', alignItems: 'center', gap: 3, borderRadius: 1.5, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
        <Avatar 
          sx={{ 
            width: 56, 
            height: 56, 
            bgcolor: '#0284c7', 
            fontSize: '1.5rem',
            fontWeight: 800,
            borderRadius: 1
          }}
        >
          {user?.name?.charAt(0)?.toUpperCase() || 'U'}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="h6" fontWeight="800" sx={{ color: '#0f172a' }}>
              {user?.name || 'User'}
            </Typography>
            <Chip 
              label={isAdmin ? 'Administrator' : 'Collector'} 
              size="small"
              sx={{ 
                fontWeight: 700, 
                borderRadius: 1,
                bgcolor: isAdmin ? '#e0f2fe' : '#f1f5f9',
                color: isAdmin ? '#0284c7' : '#475569'
              }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary">{user?.email || 'user@example.com'}</Typography>
        </Box>
      </Paper>

      {/* Preferences Section */}
      <Paper elevation={0} sx={{ width: '100%', mb: 3, borderRadius: 1.5, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <Box sx={{ p: 2, px: 3, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <Typography variant="subtitle2" fontWeight="800" sx={{ color: '#0369a1', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Preferences
          </Typography>
        </Box>
        <List sx={{ py: 0 }}>
          <ListItem sx={{ py: 1.5 }}>
            <ListItemIcon sx={{ color: '#0284c7' }}>
              <Notifications />
            </ListItemIcon>
            <ListItemText 
              primary="Notifications" 
              secondary="Enable status notifications for collection submissions"
              primaryTypographyProps={{ fontWeight: 600 }}
            />
            <Switch defaultChecked color="primary" />
          </ListItem>
          <Divider sx={{ borderColor: '#e2e8f0' }} />
          
          <ListItem sx={{ py: 1.5 }}>
            <ListItemIcon sx={{ color: '#0284c7' }}>
              <DarkMode />
            </ListItemIcon>
            <ListItemText 
              primary="Light Theme Motif" 
              secondary="Light blue & white professional design mode" 
              primaryTypographyProps={{ fontWeight: 600 }}
            />
            <Switch defaultChecked disabled />
          </ListItem>
          <Divider sx={{ borderColor: '#e2e8f0' }} />
          
          <ListItem sx={{ py: 1.5 }}>
            <ListItemIcon sx={{ color: '#0284c7' }}>
              <Language />
            </ListItemIcon>
            <ListItemText 
              primary="System Language & Currency" 
              secondary="English (Philippines) • Philippine Peso (PHP ₱)" 
              primaryTypographyProps={{ fontWeight: 600 }}
            />
          </ListItem>
        </List>
      </Paper>

      {/* Data & Security Section */}
      <Paper elevation={0} sx={{ width: '100%', mb: 3, borderRadius: 1.5, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <Box sx={{ p: 2, px: 3, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <Typography variant="subtitle2" fontWeight="800" sx={{ color: '#0369a1', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Data & Security
          </Typography>
        </Box>
        <List sx={{ py: 0 }}>
          <ListItem disablePadding>
            <ListItemButton onClick={handleExportData} sx={{ py: 1.5 }}>
              <ListItemIcon sx={{ color: '#0284c7' }}><CloudDownload /></ListItemIcon>
              <ListItemText 
                primary="Export Local Backup" 
                secondary="Download a JSON backup of locally cached reports" 
                primaryTypographyProps={{ fontWeight: 600 }}
              />
              <Tooltip title="Export JSON" arrow>
                <IconButton size="small" color="primary" sx={{ borderRadius: 1 }}>
                  <CloudDownload fontSize="small" />
                </IconButton>
              </Tooltip>
            </ListItemButton>
          </ListItem>
          <Divider sx={{ borderColor: '#e2e8f0' }} />

          <ListItem disablePadding>
            <ListItemButton onClick={() => setOpenClearDialog(true)} sx={{ py: 1.5 }}>
              <ListItemIcon sx={{ color: '#ef4444' }}><DeleteForever color="error" /></ListItemIcon>
              <ListItemText 
                primary="Clear Browser Cache" 
                secondary="Reset browser local storage fallback cache" 
                primaryTypographyProps={{ color: '#ef4444', fontWeight: 600 }}
              />
              <Tooltip title="Clear Cache" arrow>
                <IconButton size="small" color="error" sx={{ borderRadius: 1 }}>
                  <DeleteForever fontSize="small" />
                </IconButton>
              </Tooltip>
            </ListItemButton>
          </ListItem>
          <Divider sx={{ borderColor: '#e2e8f0' }} />
          
          <ListItem sx={{ py: 1.5 }}>
            <ListItemIcon sx={{ color: '#0284c7' }}>
              <Security />
            </ListItemIcon>
            <ListItemText 
              primary="Supabase Cloud Security" 
              secondary="Row-Level Security (RLS) & encrypted credential authentication active" 
              primaryTypographyProps={{ fontWeight: 600 }}
            />
          </ListItem>
        </List>
      </Paper>

      {/* Footer System Info */}
      <Box sx={{ textAlign: 'center', py: 4, color: '#94a3b8' }}>
        <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, fontWeight: 600 }}>
          <Info fontSize="small" sx={{ color: '#0284c7' }} /> RCD Management System v2.0
        </Typography>
        <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
          Municipality of Concepcion, Romblon. All rights reserved.
        </Typography>
      </Box>

      <ConfirmDialog
        open={openClearDialog}
        onClose={() => setOpenClearDialog(false)}
        onConfirm={handleClearData}
        title="Clear Local Cache?"
        message="This will clear reports stored in your browser's local cache. Your Supabase cloud records remain intact."
        confirmText="Clear Cache"
        severity="error"
      />

      <Notification
        open={notification.open}
        onClose={() => setNotification({ ...notification, open: false })}
        message={notification.message}
        severity={notification.severity}
      />
    </Box>
  );
};
