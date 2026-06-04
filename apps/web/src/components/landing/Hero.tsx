import { Button } from "@/components/site/Button";
import { ArrowIcon } from "@/components/site/icons";

export function Hero() {
  return (
    <section
      id="top"
      className="relative overflow-hidden px-5 pt-28 pb-16 sm:px-8 sm:pt-36 lg:pt-44"
    >
      <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
        {/* Eyebrow chip. */}
        <p className="intro-down" style={{ animationDelay: "0.05s" }}>
          <span className="glass-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 font-mono text-[0.72rem] uppercase tracking-[0.2em] text-dim dark:bg-white/[0.03]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
            </span>
            Support, grown together
          </span>
        </p>

        {/* Headline — oversized Fraunces with a kinetic gradient word. */}
        <h1 className="intro-down mt-9" style={{ animationDelay: "0.16s" }}>
          <span
            className="block font-display text-[3.3rem] font-medium leading-[0.94] tracking-[-0.03em] text-ink sm:text-[5.4rem] lg:text-[7rem]"
            style={{ textShadow: "0 1px 40px rgba(0,0,0,0.18)" }}
          >
            Answers that feel
            <span className="relative ml-2 inline-block pr-[0.12em] italic sm:ml-4">
              {/* Brand bloom scoped to just the word "human". */}
              <span
                aria-hidden="true"
                className="hero-bloom pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[230%] w-[150%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
                style={{
                  background:
                    "radial-gradient(circle at 50% 50%, rgba(216,64,64,0.32), rgba(142,22,22,0.12) 46%, transparent 72%)",
                }}
              />
              <span className="hero-word pr-[0.04em]">human</span>
              <span
                aria-hidden="true"
                className="hero-underline absolute -bottom-2 left-0 h-[0.1em] w-[calc(100%-0.12em)] rounded-full bg-gradient-to-r from-brand to-brand-deep"
              />
            </span>
            <span className="text-brand">.</span>
          </span>
        </h1>

        {/* Supporting line. */}
        <p className="intro-down mt-8" style={{ animationDelay: "0.27s" }}>
          <span className="block max-w-xl text-[1.18rem] leading-relaxed text-soft">
            Graft answers instantly, then hands off to your team the moment a
            real person is needed.
          </span>
        </p>

        {/* Calls to action. */}
        <div
          className="intro-down mt-11 flex flex-wrap items-center justify-center gap-3"
          style={{ animationDelay: "0.38s" }}
        >
          <Button href="/auth?mode=signup">
            Get started
            <ArrowIcon className="transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
          </Button>
          <Button href="#how" variant="ghost">
            See how it works
          </Button>
        </div>
      </div>
    </section>
  );
}
