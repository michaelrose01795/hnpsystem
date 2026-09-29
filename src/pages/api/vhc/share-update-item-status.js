import { updateCustomerVhcDecision } from "@/lib/database/vhcCustomerDecision";
import { withAuditRequest } from "@/lib/audit/withAuditRequest";
export default withAuditRequest(updateCustomerVhcDecision, { actor: "customer" });
