import type { ReactNode } from "react";
import { Reveal } from "@/components/site/Reveal";
import {
  GroundedIcon,
  HandoffIcon,
  MemoryIcon,
  CraftIcon,
} from "@/components/site/icons";

type Feature = {
  icon: ReactNode;
  title: string;
  body: string;
};

const features: Feature[] = [
  {
    icon: <GroundedIcon />,
    title: "Answers it can stand behind",
    body: "Every reply is drawn from what you already know, in a voice that sounds like yours. Nothing invented, nothing off topic.",
  },
  {
    icon: <HandoffIcon />,
    title: "A soft hand to your team",
    body: "When a moment calls for a person, the conversation passes over gently. Your customer never feels dropped or asked to start again.",
  },
  {
    icon: <MemoryIcon />,
    title: "It remembers the whole story",
    body: "Each chat picks up right where it left off, across visits and days, so no one has to explain themselves twice.",
  },
  {
    icon: <CraftIcon />,
    title: "Made to feel like yours",
    body: "Shape the look, the name, and the welcome until it belongs on your site as though it had always been there.",
  },
];

export function FeatureGrid() {
  return (
    <section id="features" className="px-5 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <Reveal as="p" className="mb-4">
            <span className="font-mono text-[0.72rem] uppercase tracking-[0.16em] text-brand">
              What you get
            </span>
          </Reveal>
          <Reveal as="h2" delay={80}>
            <span className="block text-[2.1rem] leading-[1.1] text-ink sm:text-[2.7rem]">
              Care that carries through every step.
            </span>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          {features.map((feature, index) => (
            <Reveal key={feature.title} delay={index * 90}>
              <article className="group glass h-full rounded-2xl p-7 transition-[transform,box-shadow] duration-300 ease-out motion-safe:hover:-translate-y-1 hover:shadow-[0_30px_60px_-30px_rgba(216,64,64,0.42)]">
                <span className="glass-2 grid h-11 w-11 place-items-center rounded-xl text-brand transition-transform duration-300 group-hover:scale-105">
                  {feature.icon}
                </span>
                <h3 className="mt-6 text-[1.2rem] text-ink">{feature.title}</h3>
                <p className="mt-2.5 text-[0.96rem] leading-relaxed text-dim">
                  {feature.body}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
