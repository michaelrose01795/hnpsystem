// file location: src/pages/vhc/index.js
import VhcIndexRedirectUi from "@/components/page-ui/vhc/vhc-ui"; // Extracted presentation layer.
export async function getServerSideProps() {return {
    redirect: {
      destination: "/job-cards/view",
      permanent: false
    }
  };
}

export default function VhcIndexRedirect() {
  return <VhcIndexRedirectUi view="section1" />;
}
