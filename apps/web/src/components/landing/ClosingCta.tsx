import { Reveal } from "@/components/site/Reveal";
import { ArrowIcon } from "@/components/site/icons";

/**
 * A single bold red band to close on. It stays dark in both themes by design,
 * so the call to action keeps the same weight whichever mode you are in.
 */
export function ClosingCta() {
  return (
    <section className="px-5 pb-24 sm:px-8">
      <Reveal>
        <div
          className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 px-8 py-16 text-center shadow-[0_40px_90px_-40px_rgba(142,22,22,0.7)] sm:px-12 sm:py-20"
          style={{
            backgroundImage:
              "linear-gradient(158deg, #8e1616 0%, #1d1616 72%)",
          }}
        >
          {/* Brand glow accents inside the panel. */}
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
            style={{
              backgroundImage:
                "radial-gradient(38rem 22rem at 50% -22%, rgba(216,64,64,0.45), transparent 60%), radial-gradient(28rem 20rem at 8% 122%, rgba(216,64,64,0.22), transparent 60%)",
            }}
          />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-[2.2rem] leading-[1.12] text-[#f6efef] sm:text-[2.9rem]">
              Bring a little more warmth to every conversation.
            </h2>
            <p className="mx-auto mt-5 max-w-md text-[1.02rem] leading-relaxed text-[#f6efef]/75">
              Start free, add your team when you are ready, and let your customers
              feel the difference.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <a
                href="/signup"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#f6efef] px-5 py-2.5 text-[0.95rem] font-medium text-[#1d1616] shadow-[0_14px_34px_-14px_rgba(0,0,0,0.6)] transition-[transform,filter] duration-200 ease-out hover:brightness-95 motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-px"
              >
                Get started
                <ArrowIcon className="transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
              </a>
              <a
                href="#top"
                className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2.5 text-[0.95rem] font-medium text-[#f6efef]/85 transition-colors duration-200 hover:bg-white/10 hover:text-[#f6efef]"
              >
                Back to top
              </a>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
