"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 63);
}

export function OnboardingForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [editedSlug, setEditedSlug] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Please sign in again.");

      // The database function atomically creates the organisation, owner membership
      // and starter brand. Never split these writes across browser requests.
      const { error: createError } = await supabase.rpc("create_customer_organization", {
        p_name: name.trim(),
        p_slug: slug,
      });
      if (createError) throw createError;

      router.replace("/app");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Workspace could not be created.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <label className="block text-sm font-medium">
        Workspace name
        <input
          required
          minLength={2}
          maxLength={120}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (!editedSlug) setSlug(slugify(event.target.value));
          }}
          placeholder="e.g. Acme Studio"
          className="mt-2 w-full rounded-xl border border-[#dfe7e0] px-4 py-3 outline-none focus:border-[#176b4b]"
        />
      </label>
      <label className="block text-sm font-medium">
        Workspace address
        <div className="mt-2 flex items-center rounded-xl border border-[#dfe7e0] px-4 focus-within:border-[#176b4b]">
          <span className="text-sm text-[#8a968e]">socialos.app/</span>
          <input
            required
            minLength={2}
            maxLength={63}
            pattern="[a-z0-9][a-z0-9-]{1,62}"
            value={slug}
            onChange={(event) => {
              setEditedSlug(true);
              setSlug(slugify(event.target.value));
            }}
            className="min-w-0 flex-1 py-3 outline-none"
          />
        </div>
        <span className="mt-2 block text-xs text-[#87938b]">
          Use lowercase letters, numbers and hyphens.
        </span>
      </label>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        disabled={busy}
        className="w-full rounded-xl bg-[#176b4b] px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Creating workspace…" : "Create workspace"}
      </button>
      <p className="text-center text-xs text-[#9aa49d]">You will be the workspace owner.</p>
    </form>
  );
}
