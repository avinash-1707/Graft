import { Reveal } from "@/components/site/Reveal";

export function IdeaSection() {
  return (
    <section id="idea" className="px-5 py-28 sm:px-8 sm:py-36">
      <div className="mx-auto max-w-3xl text-center">
        <Reveal as="p" className="mb-7">
          <span className="font-mono text-[0.72rem] uppercase tracking-[0.16em] text-brand">
            The idea
          </span>
        </Reveal>

        <Reveal as="p" delay={90}>
          <span className="block font-display text-[1.8rem] leading-[1.32] text-ink sm:text-[2.3rem] sm:leading-[1.3]">
            To graft is to join two living things so closely they grow as one.
          </span>
        </Reveal>

        <Reveal as="p" delay={220} className="mt-7">
          <span className="mx-auto block max-w-xl text-[1.05rem] leading-relaxed text-dim">
            That is the whole thought behind the name. The ease of help that is
            always awake and the warmth of a real person, joined so gently your
            customers feel only one thing. That someone is looking after them.
          </span>
        </Reveal>
      </div>
    </section>
  );
}
