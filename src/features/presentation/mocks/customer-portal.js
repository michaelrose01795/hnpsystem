// See customer-messages.js — referenced page-ui (`customer/customer-ui`) was
// deleted in 92c14681 along with the rest of the /customer pages.
import { PageShell, ContentWidth } from "@/components/ui";
import { SectionCard } from "@/components/Section";

export default function CustomerPortalMock() {
  return (
    <PageShell>
      <ContentWidth>
        <SectionCard title="Customer · Portal">
          Customer portal UI is being rebuilt — slide retained for the deck.
        </SectionCard>
      </ContentWidth>
    </PageShell>
  );
}
