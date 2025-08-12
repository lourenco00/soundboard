import Link from "next/link";

export default function CancelPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glass rounded-2xl p-8 text-center max-w-md w-full">
        <h1 className="text-2xl font-semibold mb-2">Checkout canceled</h1>
        <p className="text-gray-600 mb-6">No worries—come back anytime.</p>
        <Link href="/" className="btn-primary rounded-xl">Return home</Link>
      </div>
    </div>
  );
}