import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Input } from "./input";
import { Label } from "./label";

interface FieldProps extends Omit<ComponentProps<"input">, "id"> {
  id: string;
  label: ReactNode;
  error?: string | undefined;
}

/** Labeled input with an inline validation message. */
function Field({ id, label, error, className, ...props }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-invalid={error ? true : undefined} {...props} />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export { Field };
