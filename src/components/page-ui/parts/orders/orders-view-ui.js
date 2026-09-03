// file location: src/components/page-ui/parts/orders/orders-view-ui.js
// Presentation layer for the standalone /order page. Mirrors the layout and
// styling the Orders tab used inside the job cards view (page-ui/job-cards/view).
import LayerTheme from "@/components/ui/LayerTheme"; // canonical layer primitive (CLAUDE.md §3.0)
import EmptyState from "@/components/ui/EmptyState";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { PageShell, SectionShell } from "@/components/ui";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { SearchBar } from "@/components/ui/searchBarAPI";
import OrderListCard from "./OrderListCard";

export default function OrdersViewUi(props) {
  const {
    PageSkeleton,
    emptyStateMessage,
    fulfilmentFilter,
    onFulfilmentFilterChange,
    onNavigateToOrder,
    onSearchValueChange,
    ordersLoading,
    searchPlaceholder,
    searchValue,
    sortedOrders,
  } = props;

  switch (props.view) {
    case "section1":
      return <PageSkeleton />;

    case "section2":
      return <PageShell sectionKey="orders-view-shell">
      <div className="app-page-stack job-cards-view-page-stack">
          <SectionShell sectionKey="orders-view-list-shell" parentKey="orders-view-shell" style={{
          flex: 1,
          overflow: "hidden",
          padding: "10px",
          minHeight: "0"
        }}>
            <DevLayoutSection
              sectionKey="orders-view-controls"
              parentKey="orders-view-list-shell"
              sectionType="toolbar"
              className="job-cards-view-toolbar"
              style={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "var(--layout-card-gap)"
              }}>
              <SearchBar
                data-presentation="orders-search"
                className="job-cards-view-searchbar"
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(event) => onSearchValueChange(event.target.value)}
                onClear={() => onSearchValueChange("")}
                style={{ flex: "1 1 18rem", minWidth: 0 }}
              />
              <DropdownField
                name="fulfilment"
                ariaLabel="Filter orders by fulfilment type"
                value={fulfilmentFilter}
                onChange={(event) => onFulfilmentFilterChange(event.target.value)}
                options={[
                  { value: "all", label: "All fulfilment" },
                  { value: "collection", label: "Collection" },
                  { value: "delivery", label: "Delivery" }
                ]}
                style={{ flex: "0 1 13rem", minWidth: "11rem" }}
              />
            </DevLayoutSection>
            <DevLayoutSection sectionKey="orders-view-list-viewport" parentKey="orders-view-list-shell" sectionType="scroll-region" style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "10px"
          }}>
              {ordersLoading ? <LayerTheme sectionKey="orders-view-loading" parentKey="orders-view-list-viewport" sectionType="state-banner" radius="var(--radius-sm)" padding="32px" style={{
              textAlign: "center",
              color: "var(--text-2)"
            }}>
                  Loading orders...
                </LayerTheme> : sortedOrders.length === 0 ? <LayerTheme sectionKey="orders-view-empty-state" parentKey="orders-view-list-viewport" sectionType="state-banner" radius="var(--radius-sm)" padding="8px">
                  <EmptyState variant="bare" role="status" icon="🔍" title={emptyStateMessage} />
                </LayerTheme> : sortedOrders.map((order, index) => <OrderListCard key={order.id || order.orderNumber} sectionKey={`orders-view-order-row-${order.id || order.orderNumber || index + 1}`} parentKey="orders-view-list-viewport" order={order} index={index} onNavigate={() => onNavigateToOrder(order.orderNumber)} />)}
            </DevLayoutSection>
          </SectionShell>
        </div>
      </PageShell>;

    default:
      return null;
  }
}
