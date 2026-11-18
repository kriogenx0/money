"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/", label: "Spending" },
  { href: "/categories", label: "Categories" },
  { href: "/accounts", label: "Accounts" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname === "/login") return null;
  return (
    <nav className="nav">
      <Link href="/" className="brand">Money</Link>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={pathname === l.href ? "active" : ""}>
          {l.label}
        </Link>
      ))}
      <span className="spacer" />
      <button
        className="link"
        onClick={async () => {
          await fetch("/api/logout", { method: "POST" });
          router.push("/login");
        }}
      >
        Sign out
      </button>
    </nav>
  );
}
