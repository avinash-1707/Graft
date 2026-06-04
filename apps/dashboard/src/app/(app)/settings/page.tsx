import { PageHeader } from "@/components/common/page-header";
import { AiProviderSection } from "@/components/settings/ai-provider-section";
import { WidgetConfigSection } from "@/components/settings/widget-config-section";
import { EscalationSection } from "@/components/settings/escalation-section";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Provider keys, widget appearance, and escalation rules." />
      <div className="space-y-6">
        <AiProviderSection />
        <WidgetConfigSection />
        <EscalationSection />
      </div>
    </>
  );
}
