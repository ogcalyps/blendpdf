'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { PenLine, Upload, Type, X } from 'lucide-react';

type SignatureMode = 'draw' | 'upload' | 'type';

// Cursive fonts loaded via next/font/google CSS variables
const SIGNATURE_FONTS = [
    { label: 'Elegant', css: 'var(--font-dancing-script), cursive' },
    { label: 'Classic', css: 'var(--font-pinyon-script), cursive' },
    { label: 'Modern', css: 'var(--font-great-vibes), cursive' },
    { label: 'Script',  css: 'var(--font-satisfy), cursive' },
];

interface SignaturePadProps {
    onSave: (base64Image: string) => void;
    onClear?: () => void;
    title?: string;
    width?: number | string;
    height?: number;
    initialValue?: string;
}

export function SignaturePad({ onSave, onClear, title = 'Sign Here', width = '100%', height = 160, initialValue }: SignaturePadProps) {
    const [mode, setMode] = useState<SignatureMode>('draw');
    const [hasValue, setHasValue] = useState(() => !!(initialValue && initialValue.startsWith('data:image')));

    // ── DRAW mode ──────────────────────────────────────────────────────────
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(false);
    const initialValueLoaded = useRef(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        ctx.scale(ratio, ratio);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#1a1a2e';

        if (initialValue && initialValue.startsWith('data:image') && !initialValueLoaded.current) {
            initialValueLoaded.current = true;
            const img = new window.Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0, canvas.offsetWidth, canvas.offsetHeight);
                setHasDrawn(true);
                setHasValue(true);
            };
            img.src = initialValue;
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // mount-only

    const getCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        if ('touches' in e && e.touches.length > 0) {
            return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
        }
        return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const { x, y } = getCoords(e);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = '#1a1a2e';
            ctx.beginPath(); ctx.moveTo(x, y);
            setIsDrawing(true);
        }
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const { x, y } = getCoords(e);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) { ctx.lineTo(x, y); ctx.stroke(); setHasDrawn(true); }
    };

    const stopDrawing = useCallback(() => {
        if (!isDrawing) return;
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.closePath();
            setIsDrawing(false);
            if (canvasRef.current) {
                const base64 = canvasRef.current.toDataURL('image/png');
                onSave(base64);
                setHasValue(true);
            }
        }
    }, [isDrawing, onSave]);

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            initialValueLoaded.current = false;
            setHasDrawn(false);
        }
    };

    // ── UPLOAD mode ────────────────────────────────────────────────────────
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadPreview, setUploadPreview] = useState<string | null>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const result = ev.target?.result as string;
            setUploadPreview(result);
            onSave(result);
            setHasValue(true);
        };
        reader.readAsDataURL(file);
    };

    // ── TYPE mode ──────────────────────────────────────────────────────────
    const [typedName, setTypedName] = useState('');
    const [selectedFont, setSelectedFont] = useState(0);
    const typeCanvasRef = useRef<HTMLCanvasElement>(null);

    const renderTypedSignature = useCallback(async (name: string, fontIdx: number) => {
        const canvas = typeCanvasRef.current;
        if (!canvas || !name.trim()) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Ensure fonts are loaded before drawing
        await document.fonts.ready;

        // Resolve CSS variable to actual font name for canvas context
        const temp = document.createElement('span');
        temp.style.fontFamily = SIGNATURE_FONTS[fontIdx].css;
        // Optimization: don't actually append to body if we can help it, 
        // but we need it in the DOM tree for variables to resolve usually.
        temp.style.position = 'absolute';
        temp.style.visibility = 'hidden';
        document.body.appendChild(temp);
        const resolvedFont = getComputedStyle(temp).fontFamily;
        document.body.removeChild(temp);

        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        ctx.scale(ratio, ratio);
        ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

        const fontSize = Math.min(canvas.offsetWidth / name.length * 1.4, canvas.offsetHeight * 0.55);
        ctx.font = `${fontSize}px ${resolvedFont}`;
        ctx.fillStyle = '#1a1a2e';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(name, canvas.offsetWidth / 2, canvas.offsetHeight / 2);
    }, []);

    useEffect(() => {
        if (mode === 'type' && typedName) {
            // small delay to let fonts load
            const t = setTimeout(() => renderTypedSignature(typedName, selectedFont), 100);
            return () => clearTimeout(t);
        }
    }, [mode, typedName, selectedFont, renderTypedSignature]);

    const applyTypedSignature = () => {
        const canvas = typeCanvasRef.current;
        if (!canvas || !typedName.trim()) return;
        const base64 = canvas.toDataURL('image/png');
        onSave(base64);
        setHasValue(true);
    };

    // ── CLEAR ALL ──────────────────────────────────────────────────────────
    const handleClearAll = () => {
        clearCanvas();
        setUploadPreview(null);
        setTypedName('');
        setHasValue(false);
        onSave('');
        if (onClear) onClear();
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // ── TABS ───────────────────────────────────────────────────────────────
    const tabs: { id: SignatureMode; label: string; icon: React.ReactNode }[] = [
        { id: 'draw', label: 'Draw', icon: <PenLine size={14} /> },
        { id: 'upload', label: 'Upload', icon: <Upload size={14} /> },
        { id: 'type', label: 'Type', icon: <Type size={14} /> },
    ];

    return (
        <div className="flex flex-col gap-2">
            {/* Header */}
            <div className="flex justify-between items-center">
                <label className="text-sm font-bold text-gray-700">{title}</label>
                {hasValue && (
                    <button
                        type="button"
                        onClick={handleClearAll}
                        className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded bg-red-50 hover:bg-red-100 transition"
                    >
                        <X size={12} /> Clear
                    </button>
                )}
            </div>

            {/* Tab switcher */}
            <div className="flex rounded-xl bg-gray-100 p-1 gap-1">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setMode(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 px-3 rounded-lg transition-all duration-200
                            ${mode === tab.id
                                ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* ── DRAW panel ────────────────────────────────────────── */}
            <div className={mode === 'draw' ? 'block' : 'hidden'}>
                <div
                    className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-white shadow-inner relative touch-none"
                    style={{ width, height }}
                >
                    <canvas
                        ref={canvasRef}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={(e) => { e.stopPropagation(); startDrawing(e); }}
                        onTouchMove={(e) => { e.stopPropagation(); draw(e); }}
                        onTouchEnd={(e) => { e.stopPropagation(); stopDrawing(); }}
                        className="w-full h-full cursor-crosshair"
                        style={{ width: '100%', height: '100%' }}
                    />
                    {!hasDrawn && (
                        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center gap-2 opacity-40">
                            <PenLine size={22} className="text-gray-400" />
                            <span className="text-gray-400 text-sm">Draw your signature here</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── UPLOAD panel ──────────────────────────────────────── */}
            <div className={mode === 'upload' ? 'block' : 'hidden'}>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                />
                {uploadPreview ? (
                    <div
                        className="border-2 border-gray-200 rounded-xl overflow-hidden bg-white flex items-center justify-center"
                        style={{ height }}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={uploadPreview} alt="Uploaded signature" className="max-h-full max-w-full object-contain p-3" />
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-blue-50 hover:border-blue-400 transition-all duration-200 text-gray-500 hover:text-blue-600"
                        style={{ height }}
                    >
                        <Upload size={28} />
                        <span className="text-sm font-medium">Click to upload signature image</span>
                        <span className="text-xs text-gray-400">PNG, JPG, SVG supported</span>
                    </button>
                )}
                {uploadPreview && (
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-2 text-xs text-blue-500 hover:text-blue-700 font-medium underline"
                    >
                        Replace image
                    </button>
                )}
            </div>

            {/* ── TYPE panel ────────────────────────────────────────── */}
            <div className={mode === 'type' ? 'block' : 'hidden'}>
                <div className="space-y-3">
                    <input
                        type="text"
                        value={typedName}
                        onChange={(e) => {
                            setTypedName(e.target.value);
                        }}
                        placeholder="Type your full name…"
                        className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition bg-white text-sm"
                    />

                    {/* Font selector */}
                    {typedName && (
                        <div className="flex gap-2 flex-wrap">
                            {SIGNATURE_FONTS.map((font, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setSelectedFont(idx)}
                                    className={`px-3 py-1 rounded-lg border text-xs font-medium transition
                                        ${selectedFont === idx
                                            ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-300'
                                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                        }`}
                                >
                                    {font.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Preview canvas */}
                    <div
                        className="border-2 border-gray-200 rounded-xl bg-white flex items-center justify-center relative overflow-hidden"
                        style={{ height }}
                    >
                        {typedName ? (
                            <>
                                <canvas
                                    ref={typeCanvasRef}
                                    className="w-full h-full"
                                    style={{ width: '100%', height: '100%' }}
                                />
                            </>
                        ) : (
                            <span className="text-gray-400 text-sm">Signature preview will appear here</span>
                        )}
                    </div>

                    {typedName && (
                        <button
                            type="button"
                            onClick={applyTypedSignature}
                            className="w-full py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition text-sm active:scale-95"
                        >
                            Use This Signature
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
