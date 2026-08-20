import { X } from 'lucide-react';

interface MonetizationModalProps {
    isOpen: boolean;
    onClose: () => void;
    rowCount: number;
}

export function MonetizationModal({ isOpen, onClose, rowCount }: MonetizationModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-8 max-w-md w-full relative shadow-2xl">
                <button onClick={onClose} className="absolute right-4 top-4 p-2 text-gray-400 hover:text-gray-800 transition rounded-full hover:bg-gray-100">
                    <X size={24} />
                </button>

                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                    <span className="text-3xl">📄</span>
                </div>

                <h2 className="text-2xl font-bold mb-3 text-gray-900">Batch Fill Limit Reached</h2>

                <p className="text-gray-600 mb-6 leading-relaxed">
                    You&apos;re trying to fill <strong className="text-gray-900">{rowCount} forms</strong>. Batch filling is
                    limited to 50 rows per upload to keep processing reliable. Please split your spreadsheet into smaller
                    batches, or <a href="mailto:contact@blendpdf.com" className="text-blue-600 underline hover:text-blue-800">contact us</a> if
                    you regularly need larger runs.
                </p>

                <div className="space-y-3">
                    <button onClick={onClose} className="block w-full text-center bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-500/30">
                        Got it
                    </button>
                </div>
            </div>
        </div>
    );
}
