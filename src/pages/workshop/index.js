// file location: src/pages/workshop/index.js
import WorkshopIndexRedirectUi from "@/components/page-ui/workshop/workshop-ui"; // Extracted presentation layer.
export async function getServerSideProps() {return {
    redirect: {
      destination: "/workshop/consumables-tracker",
      permanent: false
    }
  };
}

export default function WorkshopIndexRedirect() {
  return <WorkshopIndexRedirectUi view="section1" />;
}
