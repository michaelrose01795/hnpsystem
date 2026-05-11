// NOTE: the original `@/components/page-ui/customer/customer-messages-ui` was
// removed in commit 92c14681 along with the rest of the /customer pages.
// This mock renders a placeholder until the customer UI is rebuilt.
import { PageShell, ContentWidth } from "@/components/ui";
import { SectionCard } from "@/components/Section";

export default function CustomerMessagesMock() {
  return (
    <PageShell>
      <ContentWidth>
        <SectionCard title="Customer · Messages">
          Customer messaging UI is being rebuilt — slide retained for the deck.
        </SectionCard>
      </ContentWidth>
    </PageShell>
  );
}
