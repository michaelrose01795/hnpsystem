export default function StatCard({ title, count, color }) {
  return (
    <div className={`p-4 rounded shadow-md text-white ${color} flex flex-col items-center justify-center`}>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-2xl font-bold mt-2">{count}</p>
    </div>
  );
}