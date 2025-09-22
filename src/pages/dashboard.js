// file: src/pages/dashboard.js
import { useEffect } from "react";
import { useRouter } from "next/router";
import { useUser } from "../context/UserContext";
import Layout from "../components/Layout";

export default function Dashboard() {
  const { user } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    const role = user.roles?.[0]?.toUpperCase();
    switch (role) {
      case "SERVICE":
        router.replace("/dashboard/service");
        break;
      case "TECHS":
      case "WORKSHOP":
        router.replace("/dashboard/techs");
        break;
      case "PARTS":
        router.replace("/dashboard/parts");
        break;
      case "MANAGER":
        router.replace("/dashboard/manager");
        break;
      default:
        router.replace("/newsfeed");
    }
  }, [user, router]);

  return (
    <Layout>
      <p>Redirecting to your dashboard...</p>
    </Layout>
  );
}
