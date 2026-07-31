"use client";

import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";

type ConfirmModalProps = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [isOpen]);

  const handleCancel = useCallback(() => {
    setVisible(false);
    setTimeout(onCancel, 200);
  }, [onCancel]);

  const handleConfirm = useCallback(() => {
    setVisible(false);
    setTimeout(onConfirm, 200);
  }, [onConfirm]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCancel();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, handleCancel]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-200 ${visible ? "bg-black/30 backdrop-blur-sm" : "bg-transparent"}`}
      onClick={handleCancel}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transition-all duration-200 ${visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
            <button
              onClick={handleCancel}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          <p className="text-sm text-slate-500 leading-relaxed">{message}</p>
        </div>

        <div className="flex gap-3 px-6 py-4">
          <button
            onClick={handleCancel}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-soft-100 hover:bg-soft-200 rounded-xl transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl transition-colors ${
              variant === "danger"
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-slate-900 hover:bg-black text-white"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// Hook for easy usage
export function useConfirmModal() {
  const [state, setState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    variant?: "danger" | "default";
    resolve?: (value: boolean) => void;
  }>({ isOpen: false, title: "", message: "" });

  const confirm = useCallback(
    (opts: { title: string; message: string; confirmLabel?: string; variant?: "danger" | "default" }): Promise<boolean> => {
      return new Promise((resolve) => {
        setState({ ...opts, isOpen: true, resolve });
      });
    },
    []
  );

  const modalProps = {
    isOpen: state.isOpen,
    title: state.title,
    message: state.message,
    confirmLabel: state.confirmLabel,
    variant: state.variant,
    onConfirm: () => {
      state.resolve?.(true);
      setState((s) => ({ ...s, isOpen: false }));
    },
    onCancel: () => {
      state.resolve?.(false);
      setState((s) => ({ ...s, isOpen: false }));
    },
  };

  return { confirm, modalProps };
}
