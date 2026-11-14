import Link from "next/link";
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f7f9f6]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-3 font-semibold">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#176b4b] text-white">
            S
          </span>
          SocialOS
        </Link>
        <Link href="/" className="text-sm text-[#738078]">
          Back to home
        </Link>
      </header>
      <div className="flex justify-center px-6 py-12">{children}</div>
    </main>
  );
}
