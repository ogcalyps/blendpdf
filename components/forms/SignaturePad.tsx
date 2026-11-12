'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { clearPaper } from '@/lib/clear-paper';
import { useTranslations } from 'next-intl';
import type { FileRejection } from 'react-dropzone';
import { PenLine, Upload, Type, X } from 'lucide-react';
import { useTrackedDropzone } from '@/hooks/useTrackedDropzone';

type SignatureMode = 'draw' | 'upload' | 'type';

/**
 * The typed styles. Each family comes from a next/font CSS variable that
 * signatureFontsClassName (lib/signature-fonts) defines on this component's
 * root, so the styles work wherever the pad is mounted (sign-pdf, the form
 * templates, the editor). That module is imported when the pad mounts, so a
 * page that only might show the pad (sign-pdf) does not load ~100 KB of fonts.
 */
const SIGNATURE_FONTS = [
    { key: 'elegant', cssVar: '--font-dancing-script', weight: 700 },
    { key: 'classic', cssVar: '--font-pinyon-script', weight: 400 },
    { key: 'modern', cssVar: '--font-great-vibes', weight: 400 },
    { key: 'script', cssVar: '--font-satisfy', weight: 400 },
] as const;

const INK = '#1a1a2e';
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
/** Longest side of an uploaded signature once it is redrawn as a PNG. */
const UPLOAD_MAX_SIDE = 1200;

interface SignaturePadProps {
    /** Receives a PNG data URL, or '' when the visible mode holds no signature. */
    onSave: (base64Image: string) => void;
    onClear?: () => void;
    title?: string;
    width?: number | string;
    height?: number;
    initialValue?: string;
}

/**
 * Any uploaded image (PNG, JPEG, WebP; the browser applies EXIF rotation)
 * redrawn as a PNG data URL, at most UPLOAD_MAX_SIDE px, so every consumer
 * gets the same format (the form templates embed PNG or JPEG only). A photo
 * or scan on paper has its paper made see-through (lib/clear-paper), so a
 * signature or stamp doesn't cover the text under it.
 */
async function imageFileToPng(file: Blob): Promise<string> {
    const url = URL.createObjectURL(file);
    try {
        const img = new window.Image();
        img.src = url;
        await img.decode();
        const { naturalWidth: w, naturalHeight: h } = img;
        if (!w || !h) throw new Error('empty image');
        const scale = Math.min(1, UPLOAD_MAX_SIDE / Math.max(w, h));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('no 2d context');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
        if (clearPaper(pixels.data, canvas.width, canvas.height)) ctx.putImageData(pixels, 0, 0);
        return canvas.toDataURL('image/png');
    } finally {
        URL.revokeObjectURL(url);
    }
}

export function SignaturePad({ onSave, onClear, title, width = '100%', height = 160, initialValue }: SignaturePadProps) {
    const t = useTranslations('signaturePad');
    const [mode, setMode] = useState<SignatureMode>('draw');
    const rootRef = useRef<HTMLDivElement>(null);
    const [fontsClassName, setFontsClassName] = useState('');

    useEffect(() => {
        let mounted = true;
        import('@/lib/signature-fonts')
            .then(({ signatureFontsClassName }) => {
                if (mounted) setFontsClassName(signatureFontsClassName);
            })
            .catch(() => {
                /* the typed styles fall back to the browser's cursive font */
            });
        return () => {
            mounted = false;
        };
    }, []);

    // Parents pass a new onSave on every render; effects read the latest one through a ref.
    const onSaveRef = useRef(onSave);
    useEffect(() => {
        onSaveRef.current = onSave;
    });

    // ── DRAW mode (pointer events: mouse, pen and touch alike) ────────────
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [hasDrawn, setHasDrawn] = useState(false);
    const hasDrawnRef = useRef(false);
    const strokeRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);

    /** The draw context in CSS pixels; resizes the backing store only while the canvas is empty. */
    const drawContext = useCallback((allowResize: boolean) => {
        const canvas = canvasRef.current;
        if (!canvas || !canvas.offsetWidth || !canvas.offsetHeight) return null;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const w = Math.round(canvas.offsetWidth * ratio);
        const h = Math.round(canvas.offsetHeight * ratio);
        if (allowResize && (canvas.width !== w || canvas.height !== h)) {
            canvas.width = w;
            canvas.height = h;
        }
        ctx.setTransform(canvas.width / canvas.offsetWidth, 0, 0, canvas.height / canvas.offsetHeight, 0, 0);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3;
        ctx.strokeStyle = INK;
        return ctx;
    }, []);

    useEffect(() => {
        const ctx = drawContext(true);
        if (!ctx || !initialValue || !initialValue.startsWith('data:image')) return;
        const img = new window.Image();
        img.onload = () => {
            const canvas = canvasRef.current;
            if (!canvas || !img.naturalWidth || !img.naturalHeight) return;
            // Fit inside the pad without stretching (an uploaded image has its own aspect)
            const w = canvas.offsetWidth;
            const h = canvas.offsetHeight;
            const s = Math.min(w / img.naturalWidth, h / img.naturalHeight);
            const dw = img.naturalWidth * s;
            const dh = img.naturalHeight * s;
            ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
            hasDrawnRef.current = true;
            setHasDrawn(true);
        };
        img.src = initialValue;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // mount-only

    const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (strokeRef.current) return; // a second finger does not start a second stroke
        const ctx = drawContext(!hasDrawnRef.current);
        if (!ctx) return;
        e.preventDefault();
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
            /* capture is best-effort */
        }
        const r = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;
        // A tap leaves a dot
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 0.01, y);
        ctx.stroke();
        strokeRef.current = { pointerId: e.pointerId, x, y };
        hasDrawnRef.current = true;
        setHasDrawn(true);
    };

    const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const stroke = strokeRef.current;
        if (!stroke || stroke.pointerId !== e.pointerId) return;
        const ctx = drawContext(false);
        if (!ctx) return;
        const r = e.currentTarget.getBoundingClientRect();
        const points = e.nativeEvent.getCoalescedEvents?.() ?? [];
        ctx.beginPath();
        ctx.moveTo(stroke.x, stroke.y);
        for (const p of points.length > 0 ? points : [e.nativeEvent]) {
            stroke.x = p.clientX - r.left;
            stroke.y = p.clientY - r.top;
            ctx.lineTo(stroke.x, stroke.y);
        }
        ctx.stroke();
    };

    const endStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (strokeRef.current?.pointerId !== e.pointerId) return;
        strokeRef.current = null;
        const canvas = canvasRef.current;
        if (canvas) onSaveRef.current(canvas.toDataURL('image/png'));
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.restore();
        }
        strokeRef.current = null;
        hasDrawnRef.current = false;
        setHasDrawn(false);
    };

    // ── UPLOAD mode ────────────────────────────────────────────────────────
    const [uploadPreview, setUploadPreview] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState(false);

    const onUploadDrop = useCallback(async (accepted: File[], rejections: FileRejection[]) => {
        const file = accepted[0];
        if (!file) {
            if (rejections.length > 0) setUploadError(true);
            return;
        }
        try {
            const dataUrl = await imageFileToPng(file);
            setUploadError(false);
            setUploadPreview(dataUrl);
            onSaveRef.current(dataUrl);
        } catch {
            setUploadError(true);
        }
    }, []);

    const { getRootProps, getInputProps, open: openUpload, isDragActive } = useTrackedDropzone({
        uploadRole: 'signature_image',
        onDrop: onUploadDrop,
        accept: { 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/webp': ['.webp'] },
        maxFiles: 1,
        multiple: false,
        maxSize: MAX_UPLOAD_BYTES,
    });

    // ── TYPE mode ──────────────────────────────────────────────────────────
    const [typedName, setTypedName] = useState('');
    const [selectedFont, setSelectedFont] = useState(0);
    const typeCanvasRef = useRef<HTMLCanvasElement>(null);
    const renderSeq = useRef(0);

    // The typed signature is the value while this tab is open: re-rendered (once
    // its font has loaded) and handed up on every change, '' when the name is empty.
    useEffect(() => {
        // Bumped on every change, tab switches included, so a render still waiting for its font is dropped
        const seq = ++renderSeq.current;
        if (mode !== 'type') return;
        const name = typedName.trim();
        if (!name) {
            onSaveRef.current('');
            return;
        }
        const timer = setTimeout(async () => {
            const canvas = typeCanvasRef.current;
            const root = rootRef.current;
            if (!canvas || !root || !canvas.offsetWidth || !canvas.offsetHeight) return;
            const font = SIGNATURE_FONTS[selectedFont];
            // Empty until the font module has arrived; this effect runs again when it has
            const family = getComputedStyle(root).getPropertyValue(font.cssVar).trim();
            const stack = family ? `${family}, cursive` : 'cursive';
            const w = canvas.offsetWidth;
            const h = canvas.offsetHeight;
            let size = Math.min(h * 0.55, (w / name.length) * 1.4);
            const spec = (px: number) => `${font.weight} ${px}px ${stack}`;
            try {
                // A webfont is only fetched once something uses it; canvas text does not count.
                await document.fonts.load(spec(size), name);
            } catch {
                /* draw with whatever the browser has */
            }
            if (seq !== renderSeq.current) return;
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = Math.round(w * ratio);
            canvas.height = Math.round(h * ratio);
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
            ctx.font = spec(size);
            const measured = ctx.measureText(name).width;
            if (measured > w * 0.92) {
                size *= (w * 0.92) / measured;
                ctx.font = spec(size);
            }
            ctx.fillStyle = INK;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(name, w / 2, h / 2);
            onSaveRef.current(canvas.toDataURL('image/png'));
        }, 120);
        return () => clearTimeout(timer);
    }, [mode, typedName, selectedFont, fontsClassName]);

    // ── TABS ───────────────────────────────────────────────────────────────
    /** Switching tabs makes that tab's content the value (type mode hands it up from its effect). */
    const switchMode = (next: SignatureMode) => {
        if (next === mode) return;
        setMode(next);
        if (next === 'draw') onSaveRef.current(hasDrawnRef.current && canvasRef.current ? canvasRef.current.toDataURL('image/png') : '');
        if (next === 'upload') onSaveRef.current(uploadPreview ?? '');
    };

    // ── CLEAR ALL ──────────────────────────────────────────────────────────
    const handleClearAll = () => {
        clearCanvas();
        setUploadPreview(null);
        setUploadError(false);
        setTypedName('');
        onSaveRef.current('');
        onClear?.();
    };

    const hasAny = hasDrawn || uploadPreview !== null || typedName.trim() !== '';
    // The styles are Latin script fonts: a name in Arabic (or another script they lack) looks the same in all four.
    const showStyles = /\p{Script=Latin}/u.test(typedName);

    const tabs: { id: SignatureMode; label: string; icon: React.ReactNode }[] = [
        { id: 'draw', label: t('modes.draw'), icon: <PenLine size={16} /> },
        { id: 'upload', label: t('modes.upload'), icon: <Upload size={16} /> },
        { id: 'type', label: t('modes.type'), icon: <Type size={16} /> },
    ];

    const styleLabels: Record<(typeof SIGNATURE_FONTS)[number]['key'], string> = {
        elegant: t('styles.elegant'),
        classic: t('styles.classic'),
        modern: t('styles.modern'),
        script: t('styles.script'),
    };

    const clearButton = (
        <button
            type="button"
            onClick={handleClearAll}
            className="flex min-h-11 items-center gap-1 rounded-lg px-3 text-xs font-medium text-red-600 transition hover:bg-red-50 hover:text-red-700"
        >
            <X size={14} /> {t('clear')}
        </button>
    );

    return (
        <div ref={rootRef} className={`flex flex-col gap-2 ${fontsClassName}`}>
            {/* Header: with no title (a dialog has its own) it goes, and Clear sits under the pad instead, so nothing moves while drawing */}
            {title !== '' && (
                <div className="flex min-h-11 items-center justify-between gap-2">
                    <span className="text-sm font-bold text-gray-700">{title ?? t('signHere')}</span>
                    {hasAny && clearButton}
                </div>
            )}

            {/* Tab switcher */}
            <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        aria-pressed={mode === tab.id}
                        onClick={() => switchMode(tab.id)}
                        className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-semibold transition-all duration-200
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
                    className="relative touch-none overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-white shadow-inner"
                    style={{ width, height }}
                >
                    <canvas
                        ref={canvasRef}
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={endStroke}
                        onPointerCancel={endStroke}
                        onLostPointerCapture={endStroke}
                        className="h-full w-full cursor-crosshair touch-none"
                        style={{ width: '100%', height: '100%' }}
                    />
                    {!hasDrawn && (
                        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-40">
                            <PenLine size={22} className="text-gray-400" />
                            <span className="text-sm text-gray-400">{t('drawHere')}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── UPLOAD panel ──────────────────────────────────────── */}
            <div className={mode === 'upload' ? 'block' : 'hidden'}>
                {uploadPreview ? (
                    <>
                        <div
                            className="flex items-center justify-center overflow-hidden rounded-xl border-2 border-gray-200 bg-white"
                            style={{ height }}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={uploadPreview} alt={t('uploadedAlt')} className="max-h-full max-w-full object-contain p-3" />
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2">
                            <button
                                type="button"
                                onClick={openUpload}
                                className="min-h-11 px-1 text-sm font-medium text-primary underline hover:no-underline"
                            >
                                {t('replaceImage')}
                            </button>
                            {/* Without a header, Clear shares this row instead of taking one of its own */}
                            {title === '' && clearButton}
                        </div>
                        <input {...getInputProps()} />
                    </>
                ) : (
                    <div
                        {...getRootProps()}
                        className={`flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-all duration-200
                            ${isDragActive ? 'border-primary bg-orange-50 text-primary' : 'border-gray-300 bg-gray-50 text-gray-500 hover:border-primary hover:bg-orange-50 hover:text-primary'}`}
                        style={{ height }}
                    >
                        <input {...getInputProps()} />
                        <Upload size={28} />
                        <span className="text-sm font-medium">{t('uploadPrompt')}</span>
                        <span className="text-xs text-gray-400">{t('uploadFormats')}</span>
                    </div>
                )}
                {uploadError && <p className="mt-2 text-sm text-red-600">{t('uploadError')}</p>}
            </div>

            {/* ── TYPE panel ────────────────────────────────────────── */}
            <div className={mode === 'type' ? 'block' : 'hidden'}>
                <div className="space-y-3">
                    <input
                        type="text"
                        dir="auto"
                        value={typedName}
                        onChange={(e) => setTypedName(e.target.value)}
                        placeholder={t('typePlaceholder')}
                        aria-label={t('typePlaceholder')}
                        className="min-h-11 w-full rounded-xl border border-gray-300 bg-white p-3 text-base outline-none transition focus:ring-2 focus:ring-primary"
                    />

                    {showStyles && (
                        <div className="flex flex-wrap gap-2" role="group" aria-label={t('styleLabel')}>
                            {SIGNATURE_FONTS.map((font, idx) => (
                                <button
                                    key={font.key}
                                    type="button"
                                    aria-pressed={selectedFont === idx}
                                    onClick={() => setSelectedFont(idx)}
                                    style={{ fontFamily: `var(${font.cssVar}), cursive`, fontWeight: font.weight }}
                                    className={`min-h-11 max-w-full truncate rounded-lg border px-4 text-lg transition
                                        ${selectedFont === idx
                                            ? 'border-primary bg-orange-50 text-gray-900 ring-1 ring-primary'
                                            : 'border-gray-200 bg-white text-gray-700 hover:border-orange-200'
                                        }`}
                                >
                                    {/* Each button shows the name in its style */}
                                    <span className="sr-only">{styleLabels[font.key]}: </span>
                                    {typedName.trim()}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Preview: this canvas is the signature that gets used */}
                    <div
                        className="relative flex items-center justify-center overflow-hidden rounded-xl border-2 border-gray-200 bg-white"
                        style={{ height }}
                    >
                        {typedName.trim() ? (
                            <canvas
                                ref={typeCanvasRef}
                                className="h-full w-full"
                                style={{ width: '100%', height: '100%' }}
                            />
                        ) : (
                            <span className="text-sm text-gray-400">{t('previewEmpty')}</span>
                        )}
                    </div>
                </div>
            </div>
            {title === '' && hasAny && !(mode === 'upload' && uploadPreview) && <div className="flex justify-end">{clearButton}</div>}
        </div>
    );
}
