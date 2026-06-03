import { Logo } from "@/components/site/Logo";
import { Button } from "@/components/site/Button";
import { ModeToggle } from "@/components/site/ModeToggle";

const links = [
  { label: "How it works", href: "#how" },
  { label: "What you get", href: "#features" },
  { label: "The idea", href: "#idea" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-30 px-3 pt-3 sm:px-5 sm:pt-4">
      <nav className="glass mx-auto flex h-15 max-w-6xl items-center justify-between rounded-2xl px-4 py-2.5 sm:px-5">
        <a
          href="#top"
          className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45"
        >
          <Logo />
        </a>

        <ul className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="rounded-full px-3.5 py-2 text-[0.9rem] text-dim transition-colors duration-200 hover:text-ink"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-1.5">
          <ModeToggle />
          <Button href="/login" variant="ghost" className="hidden sm:inline-flex">
            Sign in
          </Button>
          <Button href="/signup">Get started</Button>
        </div>
      </nav>
    </header>
  );
}
