"use client";

import { useState } from "react";

function CopyIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

/** Copies `text` to the clipboard, flashing a checkmark on success. */
export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
      aria-label="Copy link"
      title="Copy link"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 30,
        height: 30,
        flexShrink: 0,
        background: "transparent",
        color: copied ? "var(--accent)" : "var(--muted)",
        border: "1px solid var(--border-btn)",
        borderRadius: 8,
        cursor: "pointer",
        padding: 0,
        fontSize: 13,
      }}
    >
      {copied ? "✓" : <CopyIcon />}
    </button>
  );
}
