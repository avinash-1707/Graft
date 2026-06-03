import type { ReactNode } from "react";

import { Logo } from "@/components/common/logo";
import { ModeToggle } from "@/components/common/mode-toggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Centered single-card layout for the unauthenticated auth screens. */
function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <Logo />
        <ModeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {children}
            {footer ? <div className="text-center text-sm text-muted-foreground">{footer}</div> : null}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export { AuthShell };
