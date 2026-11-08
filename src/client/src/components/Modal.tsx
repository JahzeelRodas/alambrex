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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" 
      role="dialog" 
      aria-modal
    >
      {/* Fondo oscuro traslúcido */}
      <div className="absolute inset-0 bg-void/90 backdrop-blur-sm" onClick={onClose} />
      
      {/* 
        Contenedor de la ventana: 
        1. max-h-[75vh] y max-h-[calc(100vh-5rem)] garantizan que termine MUCHO antes del borde/footer en celular.
        2. flex flex-col e overflow-hidden encapsulan el scroll solo dentro del cuerpo.
      */}
      <div className="relative panel !border-neon/40 shadow-neon-lg w-full max-w-lg max-h-[calc(100vh-5rem)] md:max-h-[80vh] flex flex-col overflow-hidden z-10">
        
        {/* Cabecera fija (shrink-0 para que nunca se aplaste) */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line shrink-0 bg-void">
          <h3 className="font-display font-bold italic text-lg sm:text-xl text-silver skew-racing truncate pr-2">
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

        {/* 
          Cuerpo del modal con scroll interno:
          Agregamos pb-8 para dar espacio suficiente en la última carrera y que sea visible al 100%.
        */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 pb-8">
          {children}
        </div>

      </div>
    </div>
  );
}