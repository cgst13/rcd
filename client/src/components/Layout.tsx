import React, { useState } from 'react';
import { 
  AppBar, 
  Box, 
  CssBaseline, 
  Drawer, 
  IconButton, 
  List, 
  ListItem, 
  ListItemButton, 
  ListItemIcon, 
  ListItemText, 
  Toolbar, 
  Typography, 
  Avatar, 
  Chip, 
  Tooltip, 
  Divider
} from '@mui/material';
import { 
  Menu as MenuIcon, 
  Dashboard, 
  Receipt, 
  Assessment, 
  Settings, 
  ListAlt, 
  Logout, 
  AccountBalance, 
  People, 
  HomeWork,
  ChevronLeft,
  ChevronRight,
  SupervisorAccount,
  AdminPanelSettings,
  Summarize,
  AccountBalanceWallet,
  Badge
} from '@mui/icons-material';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

const EXPANDED_DRAWER_WIDTH = 260;
const COLLAPSED_DRAWER_WIDTH = 76;

export const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('rcd_sidebar_collapsed') === 'true';
  });

  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'administrator';
  const drawerWidth = isCollapsed ? COLLAPSED_DRAWER_WIDTH : EXPANDED_DRAWER_WIDTH;

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleToggleCollapse = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem('rcd_sidebar_collapsed', String(nextState));
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isRouteActive = (path: string) => location.pathname === path;

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#ffffff', overflowX: 'hidden' }}>
      {/* Brand Header */}
      <Box sx={{ 
        p: isCollapsed ? 1.5 : 2, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: isCollapsed ? 'center' : 'space-between',
        gap: 1.5,
        minHeight: 64
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ 
            width: 38, 
            height: 38, 
            borderRadius: 1, 
            bgcolor: '#0284c7', 
            color: '#ffffff', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <AccountBalance sx={{ fontSize: 22 }} />
          </Box>
          {!isCollapsed && (
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#0f172a', lineHeight: 1.2, letterSpacing: '-0.2px' }} noWrap>
                RCD System
              </Typography>
              <Typography variant="caption" sx={{ color: '#0284c7', fontWeight: 600, fontSize: '0.72rem' }} noWrap>
                LGU Concepcion
              </Typography>
            </Box>
          )}
        </Box>

        {!isCollapsed && (
          <Tooltip title="Collapse sidebar" placement="left" arrow>
            <IconButton 
              size="small" 
              onClick={handleToggleCollapse} 
              sx={{ 
                color: '#64748b', 
                bgcolor: '#f8fafc',
                borderRadius: 1,
                border: '1px solid #e2e8f0',
                '&:hover': { bgcolor: '#e2e8f0', color: '#0284c7' }
              }}
            >
              <ChevronLeft fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {isCollapsed && (
        <Box sx={{ display: 'flex', justifyContent: 'center', pb: 1 }}>
          <Tooltip title="Expand sidebar" placement="right" arrow>
            <IconButton 
              size="small" 
              onClick={handleToggleCollapse} 
              sx={{ 
                color: '#0284c7', 
                bgcolor: '#f0f9ff',
                borderRadius: 1,
                border: '1px solid #bae6fd',
                '&:hover': { bgcolor: '#e0f2fe' }
              }}
            >
              <ChevronRight fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      <Divider sx={{ borderColor: '#e2e8f0' }} />

      {/* Navigation List (Flat, Non-grouped) */}
      <List sx={{ px: isCollapsed ? 1 : 1.5, py: 1.5, flex: 1, overflowY: 'auto' }}>
        
        {/* 1. Dashboard */}
        <ListItem disablePadding sx={{ mb: 0.5 }}>
          <Tooltip title={isCollapsed ? 'Dashboard' : ''} placement="right" arrow>
            <ListItemButton
              selected={isRouteActive('/dashboard')}
              onClick={() => { navigate('/dashboard'); setMobileOpen(false); }}
              sx={{
                borderRadius: 1,
                py: 0.8,
                px: isCollapsed ? 1.2 : 1.5,
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                color: isRouteActive('/dashboard') ? '#0284c7' : '#475569',
                bgcolor: isRouteActive('/dashboard') ? '#f0f9ff' : 'transparent',
                border: isRouteActive('/dashboard') ? '1px solid #bae6fd' : '1px solid transparent',
                '&:hover': { bgcolor: '#f0f9ff', color: '#0284c7' }
              }}
            >
              <ListItemIcon sx={{ minWidth: isCollapsed ? 0 : 36, color: isRouteActive('/dashboard') ? '#0284c7' : '#64748b', justifyContent: 'center' }}>
                <Dashboard />
              </ListItemIcon>
              {!isCollapsed && (
                <ListItemText 
                  primary="Dashboard" 
                  primaryTypographyProps={{ fontWeight: isRouteActive('/dashboard') ? 700 : 500, fontSize: '0.88rem' }} 
                />
              )}
            </ListItemButton>
          </Tooltip>
        </ListItem>

        {/* 2. Collections (AF 51) */}
        <ListItem disablePadding sx={{ mb: 0.5 }}>
          <Tooltip title={isCollapsed ? 'Collections (AF 51)' : ''} placement="right" arrow>
            <ListItemButton
              selected={isRouteActive('/collection')}
              onClick={() => { navigate('/collection'); setMobileOpen(false); }}
              sx={{
                borderRadius: 1,
                py: 0.8,
                px: isCollapsed ? 1.2 : 1.5,
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                color: isRouteActive('/collection') ? '#0284c7' : '#475569',
                bgcolor: isRouteActive('/collection') ? '#f0f9ff' : 'transparent',
                border: isRouteActive('/collection') ? '1px solid #bae6fd' : '1px solid transparent',
                '&:hover': { bgcolor: '#f0f9ff', color: '#0284c7' }
              }}
            >
              <ListItemIcon sx={{ minWidth: isCollapsed ? 0 : 36, color: isRouteActive('/collection') ? '#0284c7' : '#64748b', justifyContent: 'center' }}>
                <Receipt />
              </ListItemIcon>
              {!isCollapsed && (
                <ListItemText 
                  primary="Collections" 
                  secondary="AF 51 General"
                  primaryTypographyProps={{ fontWeight: isRouteActive('/collection') ? 700 : 500, fontSize: '0.88rem' }} 
                  secondaryTypographyProps={{ fontSize: '0.70rem' }}
                />
              )}
            </ListItemButton>
          </Tooltip>
        </ListItem>

        {/* 3. RPT Collection (AF 56) */}
        <ListItem disablePadding sx={{ mb: 0.5 }}>
          <Tooltip title={isCollapsed ? 'RPT Collection (AF 56)' : ''} placement="right" arrow>
            <ListItemButton
              selected={isRouteActive('/rpt-collection')}
              onClick={() => { navigate('/rpt-collection'); setMobileOpen(false); }}
              sx={{
                borderRadius: 1,
                py: 0.8,
                px: isCollapsed ? 1.2 : 1.5,
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                color: isRouteActive('/rpt-collection') ? '#0284c7' : '#475569',
                bgcolor: isRouteActive('/rpt-collection') ? '#f0f9ff' : 'transparent',
                border: isRouteActive('/rpt-collection') ? '1px solid #bae6fd' : '1px solid transparent',
                '&:hover': { bgcolor: '#f0f9ff', color: '#0284c7' }
              }}
            >
              <ListItemIcon sx={{ minWidth: isCollapsed ? 0 : 36, color: isRouteActive('/rpt-collection') ? '#0284c7' : '#64748b', justifyContent: 'center' }}>
                <HomeWork />
              </ListItemIcon>
              {!isCollapsed && (
                <ListItemText 
                  primary="RPT Collection" 
                  secondary="AF 56 Real Property"
                  primaryTypographyProps={{ fontWeight: isRouteActive('/rpt-collection') ? 700 : 500, fontSize: '0.88rem' }} 
                  secondaryTypographyProps={{ fontSize: '0.70rem' }}
                />
              )}
            </ListItemButton>
          </Tooltip>
        </ListItem>

        {/* 3b. Community Tax (BRF 0016) */}
        <ListItem disablePadding sx={{ mb: 0.5 }}>
          <Tooltip title={isCollapsed ? 'Community Tax (BRF 0016)' : ''} placement="right" arrow>
            <ListItemButton
              selected={isRouteActive('/community-tax')}
              onClick={() => { navigate('/community-tax'); setMobileOpen(false); }}
              sx={{
                borderRadius: 1,
                py: 0.8,
                px: isCollapsed ? 1.2 : 1.5,
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                color: isRouteActive('/community-tax') ? '#0284c7' : '#475569',
                bgcolor: isRouteActive('/community-tax') ? '#f0f9ff' : 'transparent',
                border: isRouteActive('/community-tax') ? '1px solid #bae6fd' : '1px solid transparent',
                '&:hover': { bgcolor: '#f0f9ff', color: '#0284c7' }
              }}
            >
              <ListItemIcon sx={{ minWidth: isCollapsed ? 0 : 36, color: isRouteActive('/community-tax') ? '#0284c7' : '#64748b', justifyContent: 'center' }}>
                <Badge />
              </ListItemIcon>
              {!isCollapsed && (
                <ListItemText 
                  primary="Community Tax" 
                  secondary="BRF 0016 Cedula"
                  primaryTypographyProps={{ fontWeight: isRouteActive('/community-tax') ? 700 : 500, fontSize: '0.88rem' }} 
                  secondaryTypographyProps={{ fontSize: '0.70rem' }}
                />
              )}
            </ListItemButton>
          </Tooltip>
        </ListItem>

        {/* 4. Reports & Summary */}
        <ListItem disablePadding sx={{ mb: 0.5 }}>
          <Tooltip title={isCollapsed ? 'Reports & Summary (Appendix 34)' : ''} placement="right" arrow>
            <ListItemButton
              selected={isRouteActive('/reports')}
              onClick={() => { navigate('/reports'); setMobileOpen(false); }}
              sx={{
                borderRadius: 1,
                py: 0.8,
                px: isCollapsed ? 1.2 : 1.5,
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                color: isRouteActive('/reports') ? '#0284c7' : '#475569',
                bgcolor: isRouteActive('/reports') ? '#f0f9ff' : 'transparent',
                border: isRouteActive('/reports') ? '1px solid #bae6fd' : '1px solid transparent',
                '&:hover': { bgcolor: '#f0f9ff', color: '#0284c7' }
              }}
            >
              <ListItemIcon sx={{ minWidth: isCollapsed ? 0 : 36, color: isRouteActive('/reports') ? '#0284c7' : '#64748b', justifyContent: 'center' }}>
                <Assessment />
              </ListItemIcon>
              {!isCollapsed && (
                <ListItemText 
                  primary="Reports & Summary" 
                  secondary="Official Appendix 34"
                  primaryTypographyProps={{ fontWeight: isRouteActive('/reports') ? 700 : 500, fontSize: '0.88rem' }} 
                  secondaryTypographyProps={{ fontSize: '0.70rem' }}
                />
              )}
            </ListItemButton>
          </Tooltip>
        </ListItem>

        {/* 4b. Admin Reports (Admin Only) */}
        {isAdmin && (
          <ListItem disablePadding sx={{ mb: 0.5 }}>
            <Tooltip title={isCollapsed ? 'Admin Reports (Admin Only)' : ''} placement="right" arrow>
              <ListItemButton
                selected={isRouteActive('/admin-reports')}
                onClick={() => { navigate('/admin-reports'); setMobileOpen(false); }}
                sx={{
                  borderRadius: 1,
                  py: 0.8,
                  px: isCollapsed ? 1.2 : 1.5,
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  color: isRouteActive('/admin-reports') ? '#0284c7' : '#475569',
                  bgcolor: isRouteActive('/admin-reports') ? '#f0f9ff' : 'transparent',
                  border: isRouteActive('/admin-reports') ? '1px solid #bae6fd' : '1px solid transparent',
                  '&:hover': { bgcolor: '#f0f9ff', color: '#0284c7' }
                }}
              >
                <ListItemIcon sx={{ minWidth: isCollapsed ? 0 : 36, color: isRouteActive('/admin-reports') ? '#0284c7' : '#64748b', justifyContent: 'center' }}>
                  <Summarize />
                </ListItemIcon>
                {!isCollapsed && (
                  <ListItemText 
                    primary="Admin Reports" 
                    secondary="Executive & Audit"
                    primaryTypographyProps={{ fontWeight: isRouteActive('/admin-reports') ? 700 : 500, fontSize: '0.88rem' }} 
                    secondaryTypographyProps={{ fontSize: '0.70rem' }}
                  />
                )}
              </ListItemButton>
            </Tooltip>
          </ListItem>
        )}

        {/* 4c. Deposits (Admin Only) */}
        {isAdmin && (
          <ListItem disablePadding sx={{ mb: 0.5 }}>
            <Tooltip title={isCollapsed ? 'Deposits (Admin Only)' : ''} placement="right" arrow>
              <ListItemButton
                selected={isRouteActive('/deposits')}
                onClick={() => { navigate('/deposits'); setMobileOpen(false); }}
                sx={{
                  borderRadius: 1,
                  py: 0.8,
                  px: isCollapsed ? 1.2 : 1.5,
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  color: isRouteActive('/deposits') ? '#0284c7' : '#475569',
                  bgcolor: isRouteActive('/deposits') ? '#f0f9ff' : 'transparent',
                  border: isRouteActive('/deposits') ? '1px solid #bae6fd' : '1px solid transparent',
                  '&:hover': { bgcolor: '#f0f9ff', color: '#0284c7' }
                }}
              >
                <ListItemIcon sx={{ minWidth: isCollapsed ? 0 : 36, color: isRouteActive('/deposits') ? '#0284c7' : '#64748b', justifyContent: 'center' }}>
                  <AccountBalanceWallet />
                </ListItemIcon>
                {!isCollapsed && (
                  <ListItemText 
                    primary="Deposits" 
                    secondary="Bank Remittances"
                    primaryTypographyProps={{ fontWeight: isRouteActive('/deposits') ? 700 : 500, fontSize: '0.88rem' }} 
                    secondaryTypographyProps={{ fontSize: '0.70rem' }}
                  />
                )}
              </ListItemButton>
            </Tooltip>
          </ListItem>
        )}

        {/* 5. Account Codes */}
        <ListItem disablePadding sx={{ mb: 0.5 }}>
          <Tooltip title={isCollapsed ? 'Account Codes' : ''} placement="right" arrow>
            <ListItemButton
              selected={isRouteActive('/account-codes')}
              onClick={() => { navigate('/account-codes'); setMobileOpen(false); }}
              sx={{
                borderRadius: 1,
                py: 0.8,
                px: isCollapsed ? 1.2 : 1.5,
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                color: isRouteActive('/account-codes') ? '#0284c7' : '#475569',
                bgcolor: isRouteActive('/account-codes') ? '#f0f9ff' : 'transparent',
                border: isRouteActive('/account-codes') ? '1px solid #bae6fd' : '1px solid transparent',
                '&:hover': { bgcolor: '#f0f9ff', color: '#0284c7' }
              }}
            >
              <ListItemIcon sx={{ minWidth: isCollapsed ? 0 : 36, color: isRouteActive('/account-codes') ? '#0284c7' : '#64748b', justifyContent: 'center' }}>
                <ListAlt />
              </ListItemIcon>
              {!isCollapsed && (
                <ListItemText 
                  primary="Account Codes" 
                  primaryTypographyProps={{ fontWeight: isRouteActive('/account-codes') ? 700 : 500, fontSize: '0.88rem' }} 
                />
              )}
            </ListItemButton>
          </Tooltip>
        </ListItem>

        {/* 6. Signatories (Visible to All Users) */}
        <ListItem disablePadding sx={{ mb: 0.5 }}>
          <Tooltip title={isCollapsed ? 'Signatories' : ''} placement="right" arrow>
            <ListItemButton
              selected={isRouteActive('/signatories')}
              onClick={() => { navigate('/signatories'); setMobileOpen(false); }}
              sx={{
                borderRadius: 1,
                py: 0.8,
                px: isCollapsed ? 1.2 : 1.5,
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                color: isRouteActive('/signatories') ? '#0284c7' : '#475569',
                bgcolor: isRouteActive('/signatories') ? '#f0f9ff' : 'transparent',
                border: isRouteActive('/signatories') ? '1px solid #bae6fd' : '1px solid transparent',
                '&:hover': { bgcolor: '#f0f9ff', color: '#0284c7' }
              }}
            >
              <ListItemIcon sx={{ minWidth: isCollapsed ? 0 : 36, color: isRouteActive('/signatories') ? '#0284c7' : '#64748b', justifyContent: 'center' }}>
                <People />
              </ListItemIcon>
              {!isCollapsed && (
                <ListItemText 
                  primary="Signatories" 
                  primaryTypographyProps={{ fontWeight: isRouteActive('/signatories') ? 700 : 500, fontSize: '0.88rem' }} 
                />
              )}
            </ListItemButton>
          </Tooltip>
        </ListItem>

        {/* 7. Users (Admin Only) */}
        {isAdmin && (
          <ListItem disablePadding sx={{ mb: 0.5 }}>
            <Tooltip title={isCollapsed ? 'Users Management (Admin Only)' : ''} placement="right" arrow>
              <ListItemButton
                selected={isRouteActive('/users')}
                onClick={() => { navigate('/users'); setMobileOpen(false); }}
                sx={{
                  borderRadius: 1,
                  py: 0.8,
                  px: isCollapsed ? 1.2 : 1.5,
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  color: isRouteActive('/users') ? '#0284c7' : '#475569',
                  bgcolor: isRouteActive('/users') ? '#f0f9ff' : 'transparent',
                  border: isRouteActive('/users') ? '1px solid #bae6fd' : '1px solid transparent',
                  '&:hover': { bgcolor: '#f0f9ff', color: '#0284c7' }
                }}
              >
                <ListItemIcon sx={{ minWidth: isCollapsed ? 0 : 36, color: isRouteActive('/users') ? '#0284c7' : '#64748b', justifyContent: 'center' }}>
                  <SupervisorAccount />
                </ListItemIcon>
                {!isCollapsed && (
                  <ListItemText 
                    primary="Users" 
                    primaryTypographyProps={{ fontWeight: isRouteActive('/users') ? 700 : 500, fontSize: '0.88rem' }} 
                  />
                )}
              </ListItemButton>
            </Tooltip>
          </ListItem>
        )}

        {/* 8. Settings */}
        <ListItem disablePadding sx={{ mb: 0.5 }}>
          <Tooltip title={isCollapsed ? 'Settings & Preferences' : ''} placement="right" arrow>
            <ListItemButton
              selected={isRouteActive('/settings')}
              onClick={() => { navigate('/settings'); setMobileOpen(false); }}
              sx={{
                borderRadius: 1,
                py: 0.8,
                px: isCollapsed ? 1.2 : 1.5,
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                color: isRouteActive('/settings') ? '#0284c7' : '#475569',
                bgcolor: isRouteActive('/settings') ? '#f0f9ff' : 'transparent',
                border: isRouteActive('/settings') ? '1px solid #bae6fd' : '1px solid transparent',
                '&:hover': { bgcolor: '#f0f9ff', color: '#0284c7' }
              }}
            >
              <ListItemIcon sx={{ minWidth: isCollapsed ? 0 : 36, color: isRouteActive('/settings') ? '#0284c7' : '#64748b', justifyContent: 'center' }}>
                <Settings />
              </ListItemIcon>
              {!isCollapsed && (
                <ListItemText 
                  primary="Settings" 
                  primaryTypographyProps={{ fontWeight: isRouteActive('/settings') ? 700 : 500, fontSize: '0.88rem' }} 
                />
              )}
            </ListItemButton>
          </Tooltip>
        </ListItem>
      </List>

      <Divider sx={{ borderColor: '#e2e8f0' }} />

      {/* User Mini Profile in Sidebar Footer */}
      <Box sx={{ 
        p: isCollapsed ? 1 : 1.5, 
        m: isCollapsed ? 1 : 1.5, 
        bgcolor: '#f8fafc', 
        borderRadius: 1.5, 
        border: '1px solid #e2e8f0', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: isCollapsed ? 'center' : 'space-between',
        gap: 1 
      }}>
        <Avatar 
          sx={{ 
            width: 34, 
            height: 34, 
            bgcolor: isAdmin ? '#0369a1' : '#0284c7', 
            fontSize: '0.88rem',
            fontWeight: 700,
            borderRadius: 1
          }}
        >
          {user?.name?.charAt(0).toUpperCase() || 'U'}
        </Avatar>
        
        {!isCollapsed && (
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight="700" noWrap sx={{ fontSize: '0.82rem', color: '#0f172a' }}>
              {user?.name || 'User'}
            </Typography>
            <Chip 
              label={isAdmin ? 'Administrator' : 'Collector'} 
              size="small"
              sx={{ 
                height: 18, 
                fontSize: '0.65rem', 
                fontWeight: 700, 
                borderRadius: 1,
                bgcolor: isAdmin ? '#e0f2fe' : '#f1f5f9',
                color: isAdmin ? '#0284c7' : '#475569',
                mt: 0.2
              }} 
            />
          </Box>
        )}

        {!isCollapsed ? (
          <Tooltip title="Sign Out" arrow>
            <IconButton color="error" size="small" onClick={handleLogout} sx={{ bgcolor: '#fee2e2', borderRadius: 1, '&:hover': { bgcolor: '#fecaca' } }}>
              <Logout sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        ) : null}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f8fafc' }}>
      <CssBaseline />

      {/* Top Navbar */}
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          bgcolor: 'rgba(255, 255, 255, 0.95)',
          borderBottom: '1px solid #e2e8f0',
          boxShadow: 'none',
          color: '#0f172a',
          transition: 'width 0.25s ease, margin-left 0.25s ease'
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 2, sm: 3 }, minHeight: 64 }}>
          {/* Mobile Menu Icon / Breadcrumbs */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Tooltip title="Toggle Menu">
              <IconButton
                color="inherit"
                aria-label="open drawer"
                edge="start"
                onClick={handleDrawerToggle}
                sx={{ display: { sm: 'none' }, color: '#0284c7', borderRadius: 1 }}
              >
                <MenuIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
              <IconButton
                color="inherit"
                edge="start"
                onClick={handleToggleCollapse}
                sx={{ display: { xs: 'none', sm: 'inline-flex' }, color: '#0284c7', bgcolor: '#f0f9ff', borderRadius: 1, border: '1px solid #bae6fd' }}
              >
                {isCollapsed ? <ChevronRight fontSize="small" /> : <ChevronLeft fontSize="small" />}
              </IconButton>
            </Tooltip>

            <Typography variant="subtitle1" fontWeight="700" sx={{ color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box component="span" sx={{ color: '#64748b', fontWeight: 500, fontSize: '0.85rem' }}>LGU Concepcion</Box>
              <Box component="span" sx={{ color: '#cbd5e1' }}>/</Box>
              <Box component="span" sx={{ color: '#0284c7' }}>
                {location.pathname === '/dashboard' && 'Dashboard'}
                {location.pathname === '/collection' && 'Collections (AF 51)'}
                {location.pathname === '/rpt-collection' && 'RPT Collection (AF 56)'}
                {location.pathname === '/reports' && 'Reports & Summaries'}
                {location.pathname === '/admin-reports' && 'Admin Reports'}
                {location.pathname === '/account-codes' && 'Chart of Accounts'}
                {location.pathname === '/signatories' && 'Authorized Signatories'}
                {location.pathname === '/users' && 'Users Management'}
                {location.pathname === '/settings' && 'Settings'}
              </Box>
            </Typography>
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {/* Right Action Icons & Badges */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Chip 
              icon={<AdminPanelSettings sx={{ fontSize: 16 }} />} 
              label={isAdmin ? 'Admin Mode' : 'Collector Mode'} 
              size="small"
              sx={{ 
                bgcolor: isAdmin ? '#e0f2fe' : '#f0fdf4',
                color: isAdmin ? '#0284c7' : '#16a34a',
                border: isAdmin ? '1px solid #bae6fd' : '1px solid #bbf7d0',
                fontWeight: 700,
                borderRadius: 1,
                display: { xs: 'none', md: 'inline-flex' }
              }}
            />

            <Tooltip title="Settings">
              <IconButton 
                onClick={() => navigate('/settings')} 
                sx={{ bgcolor: '#f0f9ff', color: '#0284c7', borderRadius: 1 }}
              >
                <Settings fontSize="small" />
              </IconButton>
            </Tooltip>

            <Tooltip title="Sign Out">
              <IconButton 
                color="error" 
                onClick={handleLogout}
                sx={{ bgcolor: '#fef2f2', borderRadius: 1 }}
              >
                <Logout fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Navigation Drawer */}
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 }, transition: 'width 0.25s ease' }}
      >
        {/* Mobile Temporary Drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: EXPANDED_DRAWER_WIDTH,
              borderRight: '1px solid #e2e8f0',
              bgcolor: '#ffffff'
            },
          }}
        >
          {drawerContent}
        </Drawer>

        {/* Desktop Permanent Drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: drawerWidth, 
              borderRight: '1px solid #e2e8f0',
              bgcolor: '#ffffff',
              transition: 'width 0.25s ease',
              overflowX: 'hidden'
            },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{ 
          flexGrow: 1, 
          p: { xs: 1.5, sm: 2.5, md: 3 }, 
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          maxWidth: '100%',
          minHeight: '100vh',
          bgcolor: '#f8fafc',
          mt: 8,
          transition: 'width 0.25s ease'
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};
