"use client";

import { Printer } from "lucide-react";

export function PrintReportButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-xl bg-[#176b4b] px-4 py-3 text-xs font-semibold text-white transition hover:bg-[#12583d]"
    >
      <Printer size={15} /> Print / Save as PDF
    </button>
  );
}
