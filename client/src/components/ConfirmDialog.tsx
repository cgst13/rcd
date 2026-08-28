import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  IconButton,
  Tooltip,
  Box,
  alpha
} from '@mui/material';
import { WarningAmber, DeleteOutline, Check, Clear, InfoOutlined } from '@mui/icons-material';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  severity?: 'error' | 'warning' | 'info';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  severity = 'error'
}) => {
  const isError = severity === 'error';
  const color = isError ? 'error' : severity === 'warning' ? 'warning' : 'primary';

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      PaperProps={{
        sx: {
          borderRadius: 4,
          border: '1px solid rgba(14, 165, 233, 0.18)',
          boxShadow: '0 25px 50px -12px rgba(2, 132, 199, 0.25)',
          maxWidth: 400,
          p: 1
        }
      }}
    >
      <Box sx={{ textAlign: 'center', pt: 2.5, px: 3 }}>
        <Box 
          sx={{ 
            display: 'inline-flex', 
            p: 2, 
            borderRadius: 3, 
            bgcolor: (theme) => alpha(theme.palette[color].main, 0.12),
            color: (theme) => theme.palette[color].main,
            mb: 2
          }}
        >
          {isError ? (
            <DeleteOutline sx={{ fontSize: 32 }} />
          ) : severity === 'warning' ? (
            <WarningAmber sx={{ fontSize: 32 }} />
          ) : (
            <InfoOutlined sx={{ fontSize: 32 }} />
          )}
        </Box>
        <DialogTitle component="div" sx={{ p: 0, mb: 1, fontWeight: '800', color: '#0f172a' }}>
          {title}
        </DialogTitle>
        <DialogContent sx={{ p: 0, pb: 2 }}>
          <DialogContentText sx={{ textAlign: 'center', color: '#64748b', fontSize: '0.92rem' }}>
            {message}
          </DialogContentText>
        </DialogContent>
      </Box>
      <DialogActions sx={{ px: 3, pb: 2.5, justifyContent: 'center', gap: 2 }}>
        <Tooltip title={cancelText} arrow>
          <IconButton 
            onClick={onClose} 
            sx={{ 
              bgcolor: '#f1f5f9',
              color: '#64748b',
              p: 1.5,
              borderRadius: 3,
              '&:hover': { bgcolor: '#e2e8f0' }
            }}
          >
            <Clear />
          </IconButton>
        </Tooltip>
        <Tooltip title={confirmText} arrow>
          <IconButton 
            onClick={() => {
              onConfirm();
              onClose();
            }} 
            color={color}
            sx={{ 
              bgcolor: isError ? '#ef4444' : '#0284c7', 
              color: '#ffffff',
              p: 1.5,
              borderRadius: 3,
              boxShadow: isError ? '0 4px 14px rgba(239, 68, 68, 0.35)' : '0 4px 14px rgba(2, 132, 199, 0.35)',
              '&:hover': { 
                bgcolor: isError ? '#dc2626' : '#0369a1',
                color: '#ffffff'
              }
            }}
          >
            {isError ? <DeleteOutline /> : <Check />}
          </IconButton>
        </Tooltip>
      </DialogActions>
    </Dialog>
  );
};
