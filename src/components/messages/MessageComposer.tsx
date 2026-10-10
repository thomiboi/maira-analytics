"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { MessagesService } from '@/services/MessagesService'

type UserOption = { id: string; label: string; email?: string }

export function MessageComposer({ onSent }: { onSent?: () => void }) {
    const [asunto, setAsunto] = useState('')
    const [cuerpo, setCuerpo] = useState('')
    const [query, setQuery] = useState('')
    const [loading, setLoading] = useState(false)
    const [options, setOptions] = useState<UserOption[]>([])
    const [selected, setSelected] = useState<Record<string, UserOption>>({})
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    useEffect(() => {
        let active = true
        const run = async () => {
            if (!query.trim()) { setOptions([]); return }
            try {
                const res = await MessagesService.userSearch(query)
                if (active) setOptions(res)
            } catch {
                if (active) setOptions([])
            }
        }
        void run()
        return () => { active = false }
    }, [query])

    const destinatarios = useMemo(() => Object.keys(selected), [selected])

    const toggleSelect = useCallback((opt: UserOption) => {
        setSelected(prev => {
            const copy = { ...prev }
            if (copy[opt.id]) delete copy[opt.id]
            else copy[opt.id] = opt
            return copy
        })
    }, [])

    const send = useCallback(async () => {
        setError(null)
        setSuccess(null)
        if (!asunto.trim() || !cuerpo.trim() || destinatarios.length === 0) {
            setError('Completa asunto, cuerpo y al menos un destinatario')
            return
        }
        setLoading(true)
        try {
            await MessagesService.sendMessage({ asunto: asunto.trim(), cuerpo: cuerpo.trim(), destinatarios })
            setSuccess('¡Mensaje enviado correctamente!')
            setAsunto(''); setCuerpo(''); setSelected({}); setQuery('')
            onSent?.()
            
            // Limpiar mensaje de éxito después de 3 segundos
            setTimeout(() => setSuccess(null), 3000)
        } catch (e: any) {
            setError(e?.message || 'No se pudo enviar el mensaje')
        } finally {
            setLoading(false)
        }
    }, [asunto, cuerpo, destinatarios, onSent])

    return (
        <div className="rounded-lg border border-[var(--border)] p-6 bg-[var(--surface)]">
            <h3 className="mb-4 font-semibold text-lg text-[var(--foreground)]">Redactar mensaje</h3>
            
            {error && (
                <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md flex items-center gap-2">
                    <span className="text-red-500">⚠️</span>
                    {error}
                </div>
            )}
            
            {success && (
                <div className="mb-4 p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md flex items-center gap-2">
                    <span className="text-green-500">✅</span>
                    {success}
                </div>
            )}
            
            <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-[var(--foreground)]">Asunto</label>
                <input
                    className="w-full rounded-md border border-[var(--border)] px-3 py-2 bg-[var(--surface-muted)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    maxLength={160}
                    value={asunto}
                    onChange={(e) => setAsunto(e.target.value)}
                    placeholder="Máx 160 caracteres"
                />
                <div className="text-xs text-[var(--text-subtle)] mt-1">{asunto.length}/160</div>
            </div>
            
            <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-[var(--foreground)]">Destinatarios</label>
                <input
                    className="w-full rounded-md border border-[var(--border)] px-3 py-2 bg-[var(--surface-muted)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar por nombre o email"
                />
                {options.length > 0 && (
                    <div className="mt-2 max-h-40 overflow-auto rounded-md border border-[var(--border)] bg-[var(--surface)] shadow-lg">
                        {options.map(opt => (
                            <label key={opt.id} className="flex items-center gap-3 px-3 py-2 border-b last:border-b-0 border-[var(--border-muted)] cursor-pointer hover:bg-[var(--surface-muted)]">
                                <input type="checkbox" checked={!!selected[opt.id]} onChange={() => toggleSelect(opt)} className="rounded" />
                                <span className="text-sm text-[var(--foreground)]">{opt.label}</span>
                            </label>
                        ))}
                    </div>
                )}
                {destinatarios.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                        {Object.values(selected).map((s) => (
                            <span key={s.id} className="text-xs rounded-full bg-blue-100 text-blue-700 px-3 py-1">
                                {s.label}
                            </span>
                        ))}
                    </div>
                )}
            </div>
            
            <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-[var(--foreground)]">Cuerpo del mensaje</label>
                <textarea
                    className="w-full rounded-md border border-[var(--border)] px-3 py-2 bg-[var(--surface-muted)] text-[var(--foreground)] min-h-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={cuerpo}
                    onChange={(e) => setCuerpo(e.target.value)}
                    placeholder="Escribe el mensaje..."
                />
            </div>
            
            <div className="flex justify-end">
                <button
                    onClick={send}
                    disabled={loading}
                    className="rounded-md bg-blue-600 text-white px-6 py-2 disabled:opacity-60 hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                    {loading ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Enviando...
                        </>
                    ) : (
                        <>
                            <span>📤</span>
                            Enviar mensaje
                        </>
                    )}
                </button>
            </div>
        </div>
    )
}


