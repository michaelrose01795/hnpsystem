import PartsApprovalTable from "@/components/Parts/PartsApprovalTable";

export default function PartsApprovalPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Approve/Deny Parts Requests</h1>
      <PartsApprovalTable />
    </div>
  );
}