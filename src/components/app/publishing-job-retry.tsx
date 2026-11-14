"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";

export function PublishingJobRetry({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function retry() {
    if (
      !window.confirm(
        "Retry this known publishing failure? Jobs with uncertain provider outcomes cannot be retried here.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/social/publishing/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry", jobId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to retry this job.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to retry this job.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void retry()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#dce8de] px-3 py-2 text-[11px] font-semibold text-[#176b4b] hover:bg-[#edf5ef] disabled:opacity-50"
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Retry
      </button>
      {error && (
        <span role="alert" className="max-w-48 text-right text-[10px] text-[#9a4b3d]">
          {error}
        </span>
      )}
    </div>
  );
}
