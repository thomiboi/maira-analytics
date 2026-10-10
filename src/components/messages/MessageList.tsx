"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { MailboxType, useMessages } from "@/hooks/useMessages";

export function MessageList({
  mailbox,
  refreshKey,
}: {
  mailbox: MailboxType;
  refreshKey?: number;
}) {
  const { items, loading, error, markRead, archive, softDelete, setMailbox } =
    useMessages(mailbox, refreshKey || 0);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);

  const handleMessageClick = (message: any) => {
    setSelectedMessage(message);
    // Marcar como leído automáticamente al abrir
    if (!message.leido) {
      markRead(message.id);
    }
  };

  const closeModal = () => {
    setSelectedMessage(null);
  };

  return (
    <>
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--surface-muted)]">
          <h3 className="font-semibold text-lg text-[var(--foreground)]">
            Bandeja de mensajes
          </h3>
          <div className="flex gap-2 text-sm">
            <button
              className={`px-4 py-2 rounded-md transition-colors ${
                mailbox === "inbox"
                  ? "bg-blue-600 text-white"
                  : "bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
              }`}
              onClick={() => setMailbox("inbox")}
            >
              Entrada
            </button>
            <button
              className={`px-4 py-2 rounded-md transition-colors ${
                mailbox === "archived"
                  ? "bg-blue-600 text-white"
                  : "bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
              }`}
              onClick={() => setMailbox("archived")}
            >
              Archivados
            </button>
            <button
              className={`px-4 py-2 rounded-md transition-colors ${
                mailbox === "sent"
                  ? "bg-blue-600 text-white"
                  : "bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
              }`}
              onClick={() => setMailbox("sent")}
            >
              Enviados
            </button>
          </div>
        </div>

        {loading && (
          <div className="p-6 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600 mx-auto"></div>
            <div className="mt-2 text-sm text-[var(--text-subtle)]">
              Cargando mensajes...
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 text-sm text-red-600 bg-red-50 border-l-4 border-red-400">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="divide-y divide-[var(--border)]">
            {items.length === 0 && (
              <div className="p-6 text-center text-[var(--text-subtle)]">
                <div className="text-4xl mb-2">📭</div>
                <div className="text-sm">No hay mensajes en esta bandeja</div>
              </div>
            )}
            {items.map((it: any) => (
              <div
                key={it.id}
                className="p-4 hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
                onClick={() => handleMessageClick(it)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="font-medium text-[var(--foreground)] mb-1 flex items-center gap-2">
                      {it.asunto}
                      {!it.leido && (
                        <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--text-subtle)] mb-2">
                      {mailbox === "sent" ? (
                        <span>
                          Enviado • {new Date(it.created_at).toLocaleString()}
                        </span>
                      ) : (
                        <span>
                          <span className="font-medium">
                            {it.remitente_nombre ?? it.remitente_email}
                          </span>{" "}
                          •{new Date(it.created_at).toLocaleString()} •
                          <span
                            className={
                              it.leido ? "text-green-600" : "text-orange-600"
                            }
                          ></span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    className="flex gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {mailbox !== "sent" && (
                      <>
                        <button
                          className="text-xs rounded-md border border-gray-300 px-3 py-1 text-gray-600 hover:bg-gray-50 transition-colors"
                          onClick={() => archive(it.id)}
                        >
                          Archivar
                        </button>
                        <button
                          className="text-xs rounded-md border border-red-300 px-3 py-1 text-red-600 hover:bg-red-50 transition-colors"
                          onClick={() => softDelete(it.id)}
                        >
                          Eliminar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal para ver mensaje completo */}
      {selectedMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface)] rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-[var(--border)]">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-[var(--foreground)]">
                  {selectedMessage.asunto}
                </h2>
                <button
                  onClick={closeModal}
                  className="text-[var(--text-subtle)] hover:text-[var(--foreground)] text-2xl"
                >
                  ×
                </button>
              </div>
              <div className="mt-2 text-sm text-[var(--text-subtle)]">
                {mailbox === "sent" ? (
                  <span>
                    Enviado el{" "}
                    {new Date(selectedMessage.created_at).toLocaleString()}
                  </span>
                ) : (
                  <span>
                    De:{" "}
                    <span className="font-medium">
                      {selectedMessage.remitente_nombre ??
                        selectedMessage.remitente_email}
                    </span>{" "}
                    •{new Date(selectedMessage.created_at).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="text-[var(--foreground)] whitespace-pre-wrap">
                {selectedMessage.cuerpo || "Sin contenido"}
              </div>
            </div>
            <div className="p-6 border-t border-[var(--border)] bg-[var(--surface-muted)]">
              <div className="flex justify-end gap-2">
                {mailbox !== "sent" && (
                  <>
                    <button
                      className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                      onClick={() => {
                        archive(selectedMessage.id);
                        closeModal();
                      }}
                    >
                      Archivar
                    </button>
                    <button
                      className="px-4 py-2 text-sm rounded-md border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
                      onClick={() => {
                        softDelete(selectedMessage.id);
                        closeModal();
                      }}
                    >
                      Eliminar
                    </button>
                  </>
                )}
                <button
                  className="px-4 py-2 text-sm rounded-md bg-gray-600 text-white hover:bg-gray-700 transition-colors"
                  onClick={closeModal}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
