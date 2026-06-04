"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { inviteAgentRequestSchema, type AgentSummary } from "@graft/shared";
import { Trash2, UserPlus, Users } from "lucide-react";

import { agentsApi } from "@/lib/api/agents";
import { ApiError } from "@/lib/api/http";
import { queryKeys } from "@/lib/api/query-keys";
import { validate, type FieldErrors } from "@/lib/form";
import { EmptyState } from "@/components/common/empty-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";

type InviteForm = { email: string; name: string };

export function AgentsManager() {
  const agents = useQuery({ queryKey: queryKeys.agents, queryFn: agentsApi.list });

  return (
    <div className="space-y-6">
      <InviteCard />
      {agents.isPending ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Spinner className="size-4" /> Loading agents…
        </div>
      ) : agents.isError ? (
        <Alert>Could not load agents.</Alert>
      ) : agents.data && agents.data.length > 0 ? (
        <ul className="space-y-2">
          {agents.data.map((agent) => (
            <AgentRow key={agent.id} agent={agent} />
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Users}
          title="No agents yet"
          description="Invite a teammate above. They'll get an email to set a password and start claiming conversations."
        />
      )}
    </div>
  );
}

function InviteCard() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<InviteForm>({ email: "", name: "" });
  const [errors, setErrors] = useState<FieldErrors<InviteForm>>({});
  const [invited, setInvited] = useState<string | null>(null);

  const invite = useMutation({
    mutationFn: (body: InviteForm) => agentsApi.invite(body),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.agents });
      setInvited(res.agent.email);
      setForm({ email: "", name: "" });
      setErrors({});
    },
  });

  function handleInvite() {
    setInvited(null);
    const result = validate(inviteAgentRequestSchema, form);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    invite.mutate(result.data);
  }

  function set<K extends keyof InviteForm>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite an agent</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="agent-name"
            label="Name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            error={errors.name}
          />
          <Field
            id="agent-email"
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            error={errors.email}
          />
        </div>
        {invite.isError ? (
          <Alert>{invite.error instanceof ApiError ? invite.error.message : "Could not send invite."}</Alert>
        ) : null}
        {invited ? <Alert tone="success">Invite sent to {invited}.</Alert> : null}
        <div className="flex justify-end">
          <Button onClick={handleInvite} disabled={invite.isPending}>
            <UserPlus className="size-4" />
            {invite.isPending ? "Sending…" : "Send invite"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AgentRow({ agent }: { agent: AgentSummary }) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => agentsApi.remove(agent.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.agents }),
  });

  const pending = agent.status === "PENDING";

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{agent.name}</p>
        <p className="truncate text-xs text-muted-foreground">{agent.email}</p>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={
            pending
              ? "rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              : "rounded-full bg-success/10 px-2 py-0.5 text-xs text-success"
          }
        >
          {pending ? "Pending" : "Active"}
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Remove ${agent.name}`}
          disabled={remove.isPending}
          onClick={() => remove.mutate()}
        >
          {remove.isPending ? <Spinner /> : <Trash2 className="text-destructive" />}
        </Button>
      </div>
    </li>
  );
}
