'use client' // Error boundaries must be Client Components

export default function GlobalError({
                                        reset,
                                    }: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    return (
        // global-error must include html and body tags
        <html lang="es">
        <body>
        <h2>Algo salió mal</h2>
        <button onClick={() => reset()}>Intentar de nuevo</button>
        </body>
        </html>
    )
}