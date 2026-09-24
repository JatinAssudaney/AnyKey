import type { ReactNode } from 'react';
import { Dialog } from './Dialog';
import { dangerButton, primaryButton, secondaryButton } from './styles';

interface ConfirmDialogProps {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  /** Styles the confirm button as destructive. */
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Asks before a change that is hard to undo. Cancel comes first, so it has focus when the dialog opens. */
export function ConfirmDialog({ title, children, confirmLabel, danger = false, onConfirm, onClose }: ConfirmDialogProps) {
  return (
    <Dialog title={title} onClose={onClose}>
      <div className="mt-3 space-y-3 text-sm">{children}</div>
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={secondaryButton}>
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={danger ? dangerButton : primaryButton}
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
