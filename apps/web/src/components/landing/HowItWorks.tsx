import { Reveal } from "@/components/site/Reveal";

const steps = [
  {
    n: "01",
    title: "Add it to your site",
    body: "Drop one small piece onto your pages. Nothing else about your setup needs to change.",
  },
  {
    n: "02",
    title: "Let it learn your world",
    body: "Share what you already know and Graft grounds every answer in it, quietly and carefully.",
  },
  {
    n: "03",
    title: "People feel looked after",
    body: "Customers get quick, honest help, and your team steps in the moment it truly matters.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how"
      className="border-y border-line bg-glass px-5 py-24 backdrop-blur-xl sm:px-8 sm:py-32"
    >
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <Reveal as="p" className="mb-4">
            <span className="font-mono text-[0.72rem] uppercase tracking-[0.16em] text-brand">
              How it works
            </span>
          </Reveal>
          <Reveal as="h2" delay={80}>
            <span className="block text-[2.1rem] leading-[1.1] text-ink sm:text-[2.7rem]">
              Live in an afternoon. Helpful from day one.
            </span>
          </Reveal>
        </div>

        <ol className="mt-16 grid gap-x-10 gap-y-12 md:grid-cols-3">
          {steps.map((step, index) => (
            <Reveal key={step.n} as="li" delay={index * 110}>
              <div className="flex h-full flex-col">
                <div className="flex items-center gap-3">
                  <span className="font-display text-[1.6rem] text-brand">{step.n}</span>
                  <span className="h-px flex-1 bg-line" aria-hidden="true" />
                </div>
                <h3 className="mt-5 text-[1.25rem] text-ink">{step.title}</h3>
                <p className="mt-2.5 text-[0.96rem] leading-relaxed text-dim">
                  {step.body}
                </p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
