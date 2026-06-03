import { MessagesSquare } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const stats = [
  { label: "Open conversations", value: "—" },
  { label: "Awaiting a person", value: "—" },
  { label: "Knowledge documents", value: "—" },
  { label: "Active agents", value: "—" },
];

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Overview" description="A quick pulse on your support workspace." />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-3xl font-display">{stat.value}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">Live metrics land in a later release.</CardContent>
          </Card>
        ))}
      </div>

      <EmptyState
        icon={MessagesSquare}
        title="No conversations yet"
        description="Once your widget is live, customer conversations will appear here in real time. Configure your provider and knowledge base to get started."
      />
    </>
  );
}
