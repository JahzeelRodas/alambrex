import type { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}


export default function Modal({ open, title, onClose, children }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-void/85 backdrop-blur-sm" onClick={onClose} />
      <div className="relative panel !border-neon/40 shadow-neon-lg w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold italic text-xl text-silver skew-racing">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-ash hover:text-neon text-2xl leading-none px-2"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
