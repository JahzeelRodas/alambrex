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
      {/* Backdrop */}
      <div className="absolute inset-0 bg-void/85 backdrop-blur-sm" onClick={onClose} />
      
      {/* Contenedor principal: Usamos flex-col y max-h-[85vh] aquí para que todo el cuadro respete la pantalla */}
      <div className="relative panel !border-neon/40 shadow-neon-lg w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        
        {/* Cabecera fija (nunca se mueve ni se oculta) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line shrink-0 bg-void">
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

        {/* Contenido con scroll independiente (overflow-y-auto y flex-1) */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {children}
        </div>

      </div>
    </div>
  );
}