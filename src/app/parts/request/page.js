import PartsRequestForm from "@/components/Parts/PartsRequestForm";

export default function PartsRequestPage() {
  const handleRequestSubmit = (data) => {
    console.log("Parts request submitted:", data);
    // TODO: Hook into backend (database + notifications for Parts Department)
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Request Parts</h1>
      <PartsRequestForm onSubmit={handleRequestSubmit} />
    </div>
  );
}