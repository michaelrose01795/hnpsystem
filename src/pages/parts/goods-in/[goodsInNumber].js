// file location: src/pages/parts/goods-in/[goodsInNumber].js
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useUser } from "@/context/UserContext";
import { ScrollArea } from "@/components/ui/scrollAPI";
import { SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";
import GoodsInDetailPageUi from "@/components/page-ui/parts/goods-in/parts-goods-in-goods-in-number-ui"; // Extracted presentation layer.

const GOODS_IN_ROLES = new Set([
"parts",
"parts manager",
"service",
"service manager",
"workshop manager",
"after sales manager",
"aftersales manager"]
);

const sectionCardStyle = {
  gap: "18px"
};

const fieldGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "14px"
};

const labelStyle = {
  fontWeight: 600,
  fontSize: "0.85rem",
  color: "var(--text-secondary)",
  textTransform: "uppercase",
  letterSpacing: "0.06em"
};

const invoiceTableStyles = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: "0 10px",
  tableLayout: "fixed"
};

const invoiceHeaderCellStyle = {
  padding: "12px 16px",
  fontSize: "0.75rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-secondary)",
  background: "var(--layer-section-level-2)"
};

const invoiceCellStyle = {
  padding: "16px",
  fontSize: "0.95rem",
  color: "var(--text-primary)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};

const invoiceRowStyle = {
  background: "var(--layer-section-level-1)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-lg)"
};

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP"
});

const isUuid = (value) =>
typeof value === "string" &&
/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

function GoodsInDetailPage() {
  const router = useRouter();
  const { user } = useUser();
  const [goodsIn, setGoodsIn] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const goodsInNumber = router.query?.goodsInNumber;
  const userRoles = useMemo(
    () => (user?.roles || []).map((role) => role.toLowerCase()),
    [user?.roles]
  );
  const hasGoodsInAccess = userRoles.some((role) => GOODS_IN_ROLES.has(role));

  useEffect(() => {
    if (!router.isReady || !goodsInNumber) return;
    let isMounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const params = new URLSearchParams({ includeItems: "true" });
        if (isUuid(goodsInNumber)) {
          params.set("goodsInId", goodsInNumber);
        } else {
          params.set("goodsInNumber", goodsInNumber);
        }
        const response = await fetch(`/api/parts/goods-in?${params.toString()}`);
        const payload = await response.json();
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || "Unable to load goods-in record");
        }
        if (isMounted) {
          setGoodsIn(payload.goodsIn);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [goodsInNumber, router.isReady]);

  if (!hasGoodsInAccess) {
    return <GoodsInDetailPageUi view="section1" />;







  }

  const items = goodsIn?.items || [];
  const totals = items.reduce(
    (acc, item) => {
      const cost = Number(item.cost_price || 0) * Number(item.quantity || 0);
      const retail = Number(item.retail_price || 0) * Number(item.quantity || 0);
      acc.cost += cost;
      acc.retail += retail;
      return acc;
    },
    { cost: 0, retail: 0 }
  );
  const jobItems = items.filter((item) => item.added_to_job);
  const stockItems = items.filter((item) => !item.added_to_job);

  return <GoodsInDetailPageUi view="section2" currencyFormatter={currencyFormatter} error={error} fieldGridStyle={fieldGridStyle} goodsIn={goodsIn} goodsInNumber={goodsInNumber} invoiceCellStyle={invoiceCellStyle} invoiceHeaderCellStyle={invoiceHeaderCellStyle} invoiceRowStyle={invoiceRowStyle} invoiceTableStyles={invoiceTableStyles} items={items} jobItems={jobItems} labelStyle={labelStyle} loading={loading} ScrollArea={ScrollArea} sectionCardStyle={sectionCardStyle} SkeletonBlock={SkeletonBlock} SkeletonKeyframes={SkeletonKeyframes} stockItems={stockItems} totals={totals} />;





























































































































































}

export default GoodsInDetailPage;
