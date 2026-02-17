import Link from "next/link";

export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
            <h1 className="text-6xl font-black mb-4 opacity-20">404</h1>
            <h2 className="text-3xl font-bold mb-4">Page Not Found</h2>
            <p className="text-muted-foreground max-w-md mb-8">
                The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
            </p>
            <Link
                href="/"
                className="px-6 py-3 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90 transition"
            >
                Return Home
            </Link>
        </div>
    );
}
