"use client";

import { useRef, useState, type DragEvent } from "react";
import { Upload } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { UPLOAD_ACCEPT } from "./format";

/**
 * Drop target + file picker for KB uploads. Drag feedback is a state-driven color/scale
 * transition (interruptible, cheap) — no keyframes, so a hover that comes and goes never
 * stutters. Reduced motion is handled globally (transitions collapse to instant).
 */
export function UploadDropzone({
  onFile,
  pending,
}: {
  onFile: (file: File) => void;
  pending: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (pending) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!pending) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center transition-colors duration-200 [transition-timing-function:var(--ease-soft)]",
        dragging ? "border-brand bg-accent/50" : "border-border bg-card",
      )}
    >
      <span
        className={cn(
          "flex size-11 items-center justify-center rounded-full bg-accent text-primary transition-transform duration-200 [transition-timing-function:var(--ease-out)]",
          dragging && "scale-110",
        )}
      >
        <Upload className="size-5" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium">
          {dragging ? "Drop to upload" : "Upload a document"}
        </p>
        <p className="text-xs text-muted-foreground">
          Drag and drop, or choose a file. PDF, Word, or text — up to 25 MB.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={UPLOAD_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
      <Button disabled={pending} onClick={() => inputRef.current?.click()}>
        {pending ? (
          <>
            <Spinner /> Uploading…
          </>
        ) : (
          "Choose file"
        )}
      </Button>
    </div>
  );
}
