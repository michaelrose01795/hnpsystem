// file location: src/pages/tracking/equipment/[assetCode].js
//
// The address printed on an equipment QR label: /tracking/equipment/EQ-0001.
// Kept short on purpose — a shorter URL is a smaller, easier-to-scan code.
// It only redirects into /tracking/Equipment-Tools with that record open; the
// page itself enforces who may see it. ?action=check or ?action=fault opens the
// check or fault form straight away.

import { normaliseAssetCode } from "@/features/tracking/equipment/equipmentModel";

const ACTIONS = new Set(["check", "fault"]);

export async function getServerSideProps({ params, query }) {
  const assetCode = normaliseAssetCode(params?.assetCode);
  const search = new URLSearchParams();
  if (assetCode) search.set("asset", assetCode);
  if (ACTIONS.has(query?.action)) search.set("action", query.action);
  const suffix = search.toString();
  return {
    redirect: {
      destination: suffix ? `/tracking/Equipment-Tools?${suffix}` : "/tracking/Equipment-Tools",
      permanent: false,
    },
  };
}

export default function EquipmentRecordRedirect() {
  return null;
}
