import type { AnchorHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost";

type ButtonLinkProps = {
  children: ReactNode;
  variant?: Variant;
  className?: string;
} & AnchorHTMLAttributes<HTMLAnchorElement>;

const base =
  "group inline-flex items-center justify-center gap-2 rounded-full text-[0.95rem] font-medium " +
  "transition-[transform,box-shadow,filter,background-color,border-color,color] duration-200 ease-out " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45 focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-base motion-safe:active:translate-y-px";

const variants: Record<Variant, string> = {
  primary:
    "bg-gradient-to-b from-brand to-brand-deep text-on-brand px-5 py-2.5 " +
    "shadow-[0_14px_34px_-14px_rgba(216,64,64,0.75)] " +
    "hover:brightness-105 hover:shadow-[0_18px_40px_-14px_rgba(216,64,64,0.85)] " +
    "motion-safe:hover:-translate-y-0.5",
  ghost:
    "px-4 py-2.5 text-soft hover:text-ink border border-transparent hover:border-line hover:bg-secondary",
};

/**
 * Link-styled button. Primary is a brand gradient that lifts and warms on hover
 * (about 200ms). Ghost stays quiet until touched. Press settles a single pixel.
 */
export function Button({
  children,
  variant = "primary",
  className,
  ...props
}: ButtonLinkProps) {
  return (
    <a className={`${base} ${variants[variant]} ${className ?? ""}`} {...props}>
      {children}
    </a>
  );
}
