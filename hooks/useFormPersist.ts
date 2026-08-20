import { useState, useEffect } from 'react';

interface FormPersistOptions {
    /**
     * Keys that are NEVER written to localStorage (sensitive data such as
     * SSN, EIN, date of birth, and signature images). They stay in React
     * state only and must be re-entered after a reload.
     */
    excludeKeys?: string[];
}

export function useFormPersist<T extends Record<string, any>>(
    key: string,
    initialData: T,
    options?: FormPersistOptions
) {
    const [formData, setFormData] = useState<T>(initialData);
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasDraft, setHasDraft] = useState(false);

    const excludeKeys = options?.excludeKeys;

    const stripExcluded = (data: T): Record<string, any> => {
        if (!excludeKeys || excludeKeys.length === 0) return data;
        const copy: Record<string, any> = { ...data };
        for (const excluded of excludeKeys) {
            delete copy[excluded];
        }
        return copy;
    };

    useEffect(() => {
        try {
            const saved = localStorage.getItem(`form_draft_${key}`);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Scrub sensitive keys persisted by older versions of this hook
                let needsRewrite = false;
                if (excludeKeys) {
                    for (const excluded of excludeKeys) {
                        if (excluded in parsed) {
                            delete parsed[excluded];
                            needsRewrite = true;
                        }
                    }
                }
                if (needsRewrite) {
                    localStorage.setItem(`form_draft_${key}`, JSON.stringify(parsed));
                }
                setFormData({ ...initialData, ...parsed });
                setHasDraft(true);
            }
        } catch (e) {
            console.warn('Failed to parse saved form data', e);
        }
        setIsLoaded(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    const setPersistedData = (data: T | ((prev: T) => T)) => {
        setFormData((prev) => {
            const next = typeof data === 'function' ? (data as any)(prev) : data;
            try {
                localStorage.setItem(`form_draft_${key}`, JSON.stringify(stripExcluded(next)));
            } catch (e) {
                console.warn('Failed to save to localStorage', e);
            }
            return next;
        });
        setHasDraft(true);
    };

    const clearPersistedData = () => {
        try {
            localStorage.removeItem(`form_draft_${key}`);
            setFormData(initialData);
            setHasDraft(false);
        } catch (e) { }
    };

    return { formData, setFormData: setPersistedData, isLoaded, clearPersistedData, hasDraft };
}
