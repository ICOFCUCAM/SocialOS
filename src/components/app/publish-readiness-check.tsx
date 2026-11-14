"use client";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, CircleAlert, Loader2, ShieldCheck } from "lucide-react";
type Finding = {
  code: string;
  severity: "blocker" | "warning" | "info";
  title: string;
  detail: string;
  accountId?: string;
};
type Result = {
  summary: {
    destinations: number;
    ready: number;
    review: number;
    blocked: number;
    blockers: number;
    warnings: number;
  };
  readiness: {
    targetId: string;
    accountId: string;
    accountName?: string;
    platform?: string;
    status: string;
    findings: Finding[];
  }[];
  findings: Finding[];
};
export function PublishReadinessCheck({ postId }: { postId: string }) {
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function assess() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/social/publishing/readiness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to assess publishing readiness.");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Readiness assessment failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => void assess()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#dfe7e0] px-3 py-2 text-[10px] font-semibold text-[#53665a] hover:bg-[#f7f9f6] disabled:opacity-50"
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}{" "}
        {busy ? "Assessing…" : "Check publishing readiness"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-[10px] text-[#9a4b3d]">
          {error}
        </p>
      )}
      {result && (
        <div className="mt-3 rounded-xl border border-[#e6ece6] bg-[#fafcf9] p-3">
          <div className="flex flex-wrap items-center gap-3 text-[10px]">
            <span className="font-semibold text-[#176b4b]">{result.summary.ready} ready</span>
            <span className="font-semibold text-[#8a6a28]">{result.summary.review} review</span>
            <span className="font-semibold text-[#9a4b3d]">{result.summary.blocked} blocked</span>
          </div>
          <div className="mt-3 space-y-3">
            {result.readiness.map((target) => (
              <div key={target.targetId} className="border-t border-[#e8eee8] pt-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold">
                    {target.accountName || target.platform || "Destination"}
                  </span>
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-[9px] capitalize " +
                      (target.status === "ready"
                        ? "bg-[#edf5ef] text-[#176b4b]"
                        : target.status === "review"
                          ? "bg-[#faf5e8] text-[#8a6a28]"
                          : "bg-[#fbefed] text-[#9a4b3d]")
                    }
                  >
                    {target.status}
                  </span>
                </div>
                {target.findings.map((f) => (
                  <div key={f.code} className="mt-2 flex gap-2">
                    <span className="mt-0.5">
                      {f.severity === "blocker" ? (
                        <CircleAlert size={12} className="text-[#9a4b3d]" />
                      ) : f.severity === "warning" ? (
                        <AlertTriangle size={12} className="text-[#8a6a28]" />
                      ) : (
                        <CheckCircle2 size={12} className="text-[#89958d]" />
                      )}
                    </span>
                    <span>
                      <span className="block text-[10px] font-semibold text-[#53665a]">
                        {f.title}
                      </span>
                      <span className="block text-[10px] leading-4 text-[#89958d]">{f.detail}</span>
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[9px] leading-4 text-[#9aa49d]">
            Assessment is advisory and reflects current stored account, content and media metadata.
            It does not guarantee provider acceptance or reserve future quota.
          </p>
        </div>
      )}
    </div>
  );
}
