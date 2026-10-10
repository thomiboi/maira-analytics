"use client";

import { CheckCircle, XCircle, X } from "lucide-react";
import { useEffect, useState } from "react";

export type ToastType = "success" | "error";

interface ToastProps {
  message: string;
  type: ToastType;
  subtitle?: string;
  onClose: () => void;
  duration?: number;
  position?: "top-right" | "bottom-right";
}

/**
 * Toast notification moderno con animaciones
 */
export default function Toast({
  message,
  type,
  subtitle,
  onClose,
  duration = 4000,
  position = "top-right",
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Aparecer con animación
    setTimeout(() => setIsVisible(true), 10);

    // Auto-cerrar después de la duración
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Esperar animación de salida
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const styles = {
    success: {
      bg: "bg-green-50 dark:bg-green-900/30",
      border: "border-green-200 dark:border-green-800",
      icon: "text-green-600 dark:text-green-400",
      text: "text-green-900 dark:text-green-100",
      subtitle: "text-green-700 dark:text-green-300",
    },
    error: {
      bg: "bg-red-50 dark:bg-red-900/30",
      border: "border-red-200 dark:border-red-800",
      icon: "text-red-600 dark:text-red-400",
      text: "text-red-900 dark:text-red-100",
      subtitle: "text-red-700 dark:text-red-300",
    },
  };

  const style = styles[type];
  const Icon = type === "success" ? CheckCircle : XCircle;

  const positionClasses = {
    "top-right": "top-4 right-4",
    "bottom-right": "bottom-4 right-4",
  };

  return (
    <div
      className={`
        fixed ${positionClasses[position]} z-[100] max-w-md w-full
        transform transition-all duration-300 ease-out
        ${
          isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
        }
      `}
    >
      <div
        className={`
          ${style.bg} ${style.border} border rounded-xl shadow-2xl
          p-4 flex items-start gap-3
        `}
      >
        <Icon className={`w-6 h-6 ${style.icon} flex-shrink-0 mt-0.5`} />

        <div className="flex-1 min-w-0">
          <p className={`font-semibold ${style.text} text-sm`}>{message}</p>
          {subtitle && (
            <p className={`text-xs ${style.subtitle} mt-1`}>{subtitle}</p>
          )}
        </div>

        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(onClose, 300);
          }}
          className={`
            flex-shrink-0 p-1 rounded-lg transition-colors
            ${style.icon} opacity-60 hover:opacity-100
            hover:bg-black/5 dark:hover:bg-white/10
          `}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
