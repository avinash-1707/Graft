import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

/** Shared section card for the settings screens: titled, with a loading state. */
function SettingsCard({
  title,
  description,
  isLoading,
  children,
}: {
  title: string;
  description: string;
  isLoading?: boolean;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        {isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Spinner className="size-4" /> Loading…
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

export { SettingsCard };
