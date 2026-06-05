import { PageHeader } from "@/components/common/page-header";
import { AiProviderSection } from "@/components/settings/ai-provider-section";
import { BillingSection } from "@/components/settings/billing-section";
import { WidgetConfigSection } from "@/components/settings/widget-config-section";
import { EscalationSection } from "@/components/settings/escalation-section";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Billing, provider keys, widget appearance, and escalation rules." />
      <div className="space-y-6">
        <BillingSection />
        <AiProviderSection />
        <WidgetConfigSection />
        <EscalationSection />
      </div>
    </>
  );
}
