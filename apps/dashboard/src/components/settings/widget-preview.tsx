import { MessageCircle } from "lucide-react";
import type { WidgetConfig } from "@graft/shared";

/**
 * Static, non-interactive mock of the customer widget panel using the live form
 * values, so owners see color/copy changes before saving. Not the real widget —
 * just a faithful sketch of its surface.
 */
function WidgetPreview({ config }: { config: WidgetConfig }) {
  const alignRight = config.launcherPosition === "BOTTOM_RIGHT";
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">Preview</span>
      <div
        className="flex w-64 flex-col overflow-hidden rounded-xl border border-border shadow-sm"
        style={{ backgroundColor: config.bgSurface }}
      >
        <div
          className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-white"
          style={{ backgroundColor: config.accentPrimary }}
        >
          <MessageCircle className="size-4" />
          {config.botName || "Support"}
        </div>
        <div className="flex flex-col gap-2 p-4">
          <div
            className="max-w-[85%] self-start rounded-2xl rounded-bl-sm px-3 py-2 text-xs"
            style={{ backgroundColor: withAlpha(config.textMuted, 0.12), color: config.textPrimary }}
          >
            {config.greeting || "How can we help?"}
          </div>
          <div
            className="max-w-[85%] self-end rounded-2xl rounded-br-sm px-3 py-2 text-xs text-white"
            style={{ backgroundColor: config.accentPrimary }}
          >
            I have a question about billing.
          </div>
        </div>
        <div className="border-t px-4 py-2.5" style={{ borderColor: withAlpha(config.textMuted, 0.2) }}>
          <span className="text-xs" style={{ color: config.textMuted }}>
            Type a message…
          </span>
        </div>
      </div>
      <div className={alignRight ? "flex justify-end" : "flex justify-start"}>
        <div
          className="flex size-10 items-center justify-center rounded-full text-white shadow-md"
          style={{ backgroundColor: config.accentPrimary }}
        >
          <MessageCircle className="size-5" />
        </div>
      </div>
    </div>
  );
}

/** Append an alpha channel to a `#rrggbb` color; leaves other forms untouched. */
function withAlpha(color: string, alpha: number): string {
  if (/^#[0-9a-fA-F]{6}$/.test(color.trim())) {
    const a = Math.round(alpha * 255)
      .toString(16)
      .padStart(2, "0");
    return `${color.trim()}${a}`;
  }
  return color;
}

export { WidgetPreview };
