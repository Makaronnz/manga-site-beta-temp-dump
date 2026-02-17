'use client';

import { useEffect } from 'react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="container mx-auto px-4 py-12 text-center">
            <h2 className="text-2xl font-semibold mb-4">Bir şeyler yanlış gitti</h2>
            <p className="opacity-70 mb-6">{error.message || 'Beklenmeyen bir hata oluştu.'}</p>
            <button
                onClick={() => reset()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90"
            >
                Tekrar dene
            </button>
        </div>
    );
}
