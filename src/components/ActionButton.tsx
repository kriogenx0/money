"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";

type Props = {
  url: string;
  method?: string;
  body?: unknown;
  label: string;
  confirm?: string;
  className?: string;
};

/** A button that calls an API route, shows the result or error, and refreshes the page. */
export default function ActionButton({ url, method = "POST", body, label, confirm, className }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="row">
      <button
        className={className}
        disabled={busy}
        onClick={async () => {
          if (confirm && !window.confirm(confirm)) return;
          setBusy(true);
          setError(null);
          try {
            await api(url, method, body);
            router.refresh();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Working…" : label}
      </button>
      {error && <span className="small error">{error}</span>}
    </span>
  );
}
