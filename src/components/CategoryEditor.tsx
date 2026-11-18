"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Category } from "@/lib/queries";
import { api } from "./api";

export function CategoryRow({ category }: { category: Category }) {
  const router = useRouter();
  const [name, setName] = useState(category.name);
  const [error, setError] = useState<string | null>(null);

  async function save(patch: Partial<{ name: string; color: string; excluded: boolean }>) {
    setError(null);
    try {
      await api(`/api/categories/${category.id}`, "PATCH", patch);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <tr>
      <td>
        <input
          type="color"
          defaultValue={category.color}
          onBlur={(e) => e.target.value !== category.color && save({ color: e.target.value })}
          aria-label="Color"
          style={{ width: 36, padding: 2 }}
        />
      </td>
      <td>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== category.name && save({ name })}
          aria-label="Name"
        />
        {error && <div className="small error">{error}</div>}
      </td>
      <td>
        <label className="small">
          <input
            type="checkbox"
            defaultChecked={!!category.excluded}
            onChange={(e) => save({ excluded: e.target.checked })}
          />{" "}
          Not spending
        </label>
      </td>
      <td className="num">
        {category.name !== "Uncategorized" && (
          <button
            className="link small"
            onClick={async () => {
              if (!window.confirm(`Delete ${category.name}? Its transactions fall back to automatic categories.`)) return;
              await api(`/api/categories/${category.id}`, "DELETE").catch((e) => setError(e.message));
              router.refresh();
            }}
          >
            Delete
          </button>
        )}
      </td>
    </tr>
  );
}

export function AddCategory() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="row"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try {
          await api("/api/categories", "POST", { name });
          setName("");
          router.refresh();
        } catch (err) {
          setError((err as Error).message);
        }
      }}
    >
      <input placeholder="New category" value={name} onChange={(e) => setName(e.target.value)} />
      <button type="submit" disabled={!name.trim()}>Add</button>
      {error && <span className="small error">{error}</span>}
    </form>
  );
}

export function AddRule({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [pattern, setPattern] = useState("");
  const [categoryId, setCategoryId] = useState<number>(categories[0]?.id ?? 0);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="row"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try {
          await api("/api/rules", "POST", { pattern, category_id: categoryId, apply_to_existing: true });
          setPattern("");
          router.refresh();
        } catch (err) {
          setError((err as Error).message);
        }
      }}
    >
      <span className="small muted">When merchant contains</span>
      <input placeholder="e.g. costco" value={pattern} onChange={(e) => setPattern(e.target.value)} />
      <span className="small muted">use</span>
      <select value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <button type="submit" className="primary" disabled={!pattern.trim()}>Add rule</button>
      {error && <span className="small error">{error}</span>}
    </form>
  );
}
