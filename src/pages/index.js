// file location: src/pages/index.js
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function HomeRedirect() {
  const router = useRouter(); // get the Next.js router

  useEffect(() => {
    router.replace("/login"); // immediately redirect to /login when page loads
  }, [router]);

  // Optional loading screen while redirecting
  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <h2 className="text-gray-600 text-lg font-medium">
        Redirecting to login...
      </h2>
    </div>
  );
}
