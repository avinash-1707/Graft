import { Logo } from "@/components/site/Logo";

const groups = [
  {
    heading: "Product",
    links: [
      { label: "How it works", href: "#how" },
      { label: "What you get", href: "#features" },
      { label: "The idea", href: "#idea" },
    ],
  },
  {
    heading: "Get started",
    links: [
      { label: "Create an account", href: "/signup" },
      { label: "Sign in", href: "/login" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-line px-5 py-14 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col justify-between gap-10 sm:flex-row">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-4 text-[0.92rem] leading-relaxed text-dim">
            Support that feels like one warm conversation, from the first hello to
            the last thank you.
          </p>
        </div>

        <div className="flex gap-16">
          {groups.map((group) => (
            <div key={group.heading}>
              <p className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-faint">
                {group.heading}
              </p>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-[0.92rem] text-dim transition-colors duration-200 hover:text-ink"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-12 flex max-w-6xl items-center justify-between border-t border-line2 pt-6">
        <p className="font-mono text-[0.74rem] text-faint">Graft, {new Date().getFullYear()}</p>
        <p className="font-mono text-[0.74rem] text-faint">Made with care</p>
      </div>
    </footer>
  );
}
