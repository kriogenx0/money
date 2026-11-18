"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink, type PlaidLinkOnSuccess } from "react-plaid-link";
import { api } from "./api";

export default function ConnectBank() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    api("/api/plaid/link-token", "POST")
      .then((d) => setToken(d.link_token))
      .catch((e) => setStatus(e.message));
  }, []);

  const onSuccess = useCallback<PlaidLinkOnSuccess>(
    async (public_token, metadata) => {
      if (!public_token) return;
      setStatus("Connecting and pulling transactions…");
      try {
        await api("/api/plaid/exchange", "POST", { public_token, institution_name: metadata.institution?.name });
        setStatus("Connected. Plaid may take a few minutes to send full history.");
        router.refresh();
      } catch (e) {
        setStatus((e as Error).message);
      }
    },
    [router],
  );

  const { open, ready } = usePlaidLink({ token, onSuccess });

  return (
    <div className="row">
      <button className="primary" disabled={!ready} onClick={() => open()}>Connect a bank</button>
      {status && <span className="small muted">{status}</span>}
    </div>
  );
}
