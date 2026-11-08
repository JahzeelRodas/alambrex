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
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4" 
      role="dialog" 
      aria-modal
    >
      {/* Fondo traslúcido */}
      <div className="absolute inset-0 bg-void/85 backdrop-blur-sm" onClick={onClose} />
      
      {/* 
        Ventana con altura predefinida fija (h-[60vh]):
        Mantiene siempre el mismo tamaño y no crece hacia el footer.
      */}
      <div className="relative panel !border-neon/40 shadow-neon-lg w-full max-w-lg h-[60vh] flex flex-col overflow-hidden z-10">
        
        {/* Cabecera fija */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line shrink-0 bg-void">
          <h3 className="font-display font-bold italic text-lg text-silver skew-racing truncate pr-2">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-ash hover:text-neon text-2xl leading-none px-2 shrink-0"
          >
            ×
          </button>
        </div>

        {/* Cuerpo interno con scroll obligatoria si sobrepasa los 60vh */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3 pb-6">
          {children}
        </div>

      </div>
    </div>
  );
}