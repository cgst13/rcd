import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Box,
  alpha
} from '@mui/material';
import { WarningAmber, DeleteOutline } from '@mui/icons-material';

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
          borderRadius: 3,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          maxWidth: 400
        }
      }}
    >
      <Box sx={{ textAlign: 'center', pt: 3, px: 3 }}>
        <Box 
          sx={{ 
            display: 'inline-flex', 
            p: 2, 
            borderRadius: '50%', 
            bgcolor: (theme) => alpha(theme.palette[color].main, 0.1),
            color: (theme) => theme.palette[color].main,
            mb: 2
          }}
        >
          {isError ? <DeleteOutline sx={{ fontSize: 32 }} /> : <WarningAmber sx={{ fontSize: 32 }} />}
        </Box>
        <DialogTitle sx={{ p: 0, mb: 1, fontWeight: 'bold' }}>
          {title}
        </DialogTitle>
        <DialogContent sx={{ p: 0, pb: 2 }}>
          <DialogContentText sx={{ textAlign: 'center', color: 'text.secondary' }}>
            {message}
          </DialogContentText>
        </DialogContent>
      </Box>
      <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'center', gap: 1 }}>
        <Button 
          onClick={onClose} 
          variant="outlined" 
          color="inherit"
          sx={{ 
            borderRadius: 2, 
            textTransform: 'none', 
            fontWeight: 600,
            px: 3
          }}
        >
          {cancelText}
        </Button>
        <Button 
          onClick={() => {
            onConfirm();
            onClose();
          }} 
          variant="contained" 
          color={color}
          disableElevation
          sx={{ 
            borderRadius: 2, 
            textTransform: 'none', 
            fontWeight: 600,
            px: 3
          }}
        >
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
