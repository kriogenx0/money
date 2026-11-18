"use client";
import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="card login">
      <h1>Money</h1>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          const res = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
          });
          if (res.ok) window.location.href = "/";
          else setError("Wrong password");
        }}
      >
        <input
          type="password"
          placeholder="Password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="primary" type="submit">Sign in</button>
        {error && <span className="small error">{error}</span>}
      </form>
    </div>
  );
}
