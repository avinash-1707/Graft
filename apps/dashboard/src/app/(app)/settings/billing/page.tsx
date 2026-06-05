import { PageHeader } from "@/components/common/page-header";
import { BillingSection } from "@/components/settings/billing-section";

export default function BillingPage() {
  return (
    <>
      <PageHeader title="Billing & Credits" description="Plan, prepaid AI credits, and top-ups." />
      <div className="space-y-6">
        <BillingSection />
      </div>
    </>
  );
}
