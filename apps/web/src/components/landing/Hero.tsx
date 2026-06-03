import { Reveal } from "@/components/site/Reveal";
import { Button } from "@/components/site/Button";
import { ArrowIcon } from "@/components/site/icons";
import { ConversationShowcase } from "@/components/landing/ConversationShowcase";

export function Hero() {
  return (
    <section id="top" className="relative px-5 pt-16 sm:px-8 sm:pt-20 lg:pt-28">
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
        <div className="max-w-xl">
          <Reveal immediate as="p" className="mb-5">
            <span className="glass-2 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 font-mono text-[0.72rem] uppercase tracking-[0.16em] text-dim">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
              Support, grown together
            </span>
          </Reveal>

          <Reveal immediate as="h1" delay={90}>
            <span className="block text-[2.6rem] leading-[1.04] text-ink sm:text-[3.4rem] lg:text-[3.85rem]">
              Where helpful answers meet a human touch.
            </span>
          </Reveal>

          <Reveal immediate as="p" delay={210} className="mt-6">
            <span className="block max-w-lg text-[1.075rem] leading-relaxed text-dim">
              Graft greets every customer with clear, grounded help and passes them
              softly to your team the moment a person is needed. One calm
              conversation, from the first hello to the last thank you.
            </span>
          </Reveal>

          <Reveal immediate delay={330} className="mt-9 flex flex-wrap items-center gap-3">
            <Button href="/signup">
              Get started
              <ArrowIcon className="transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
            </Button>
            <Button href="#how" variant="ghost">
              See how it works
            </Button>
          </Reveal>

          <Reveal immediate as="p" delay={430} className="mt-7">
            <span className="block font-mono text-[0.78rem] tracking-wide text-faint">
              Sits on your site in minutes. Speaks in your voice.
            </span>
          </Reveal>
        </div>

        <Reveal immediate delay={250} className="lg:pl-4">
          <ConversationShowcase />
        </Reveal>
      </div>
    </section>
  );
}
