import { Logo } from "@/components/site/Logo";

/**
 * A quiet snapshot of the product idea: an assistant helps, then the
 * conversation passes to a person without a seam. No product jargon on screen,
 * only the experience the customer actually feels. The whole panel is frosted
 * glass; the human reply carries the brand tint so the hand off reads at a
 * glance. Composition is static by design, the Reveal handles the entrance.
 */
export function ConversationShowcase() {
  return (
    <div className="relative">
      {/* Brand-tinted glow echoed behind the panel for depth. */}
      <div
        className="absolute inset-0 translate-x-4 translate-y-5 rounded-[1.7rem] bg-brand-soft blur-2xl"
        aria-hidden="true"
      />

      <div className="glass relative overflow-hidden rounded-[1.7rem]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line2 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="glass-2 grid h-9 w-9 place-items-center rounded-full">
              <Logo withWordmark={false} />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-[0.92rem] font-medium text-ink">Support</span>
              <span className="text-[0.76rem] text-dim">Here whenever you need</span>
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-[0.72rem] font-medium text-brand">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
            With your team
          </span>
        </div>

        {/* Transcript */}
        <div className="flex flex-col gap-3.5 px-5 py-6">
          <Bubble side="right">I think I was charged twice this morning.</Bubble>

          <Bubble side="left" tint="ai">
            I can see the duplicate and it usually clears by itself. Let me make sure
            it does, right away.
          </Bubble>

          <Joined name="Maya from your team" />

          <Bubble side="left" tint="agent" who="Maya">
            Hi, I am Maya. I have already returned the extra charge for you. It should
            land back within the hour.
          </Bubble>

          <Bubble side="right">That was so quick. Thank you.</Bubble>
        </div>

        {/* Composer (visual only) */}
        <div className="border-t border-line2 px-5 py-3.5">
          <div className="glass-2 flex items-center justify-between rounded-full px-4 py-2.5">
            <span className="text-[0.85rem] text-faint">Write a reply</span>
            <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-on-brand">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M5 12h13M12 6l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({
  children,
  side,
  tint = "plain",
  who,
}: {
  children: React.ReactNode;
  side: "left" | "right";
  tint?: "plain" | "ai" | "agent";
  who?: string;
}) {
  const tints: Record<string, string> = {
    plain: "bg-secondary text-soft",
    ai: "glass-2 text-soft",
    agent: "bg-brand-soft text-soft",
  };

  return (
    <div className={`flex flex-col ${side === "right" ? "items-end" : "items-start"}`}>
      {who && (
        <span className="mb-1 ml-1 text-[0.7rem] font-medium text-brand">{who}</span>
      )}
      <div
        className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[0.88rem] leading-snug ${tints[tint]} ${
          side === "right" ? "rounded-br-md" : "rounded-bl-md"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function Joined({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="h-px flex-1 bg-line2" aria-hidden="true" />
      <span className="text-[0.72rem] text-faint">{name} joined</span>
      <span className="h-px flex-1 bg-line2" aria-hidden="true" />
    </div>
  );
}
