// file location: src/pages/customers/index.js
import CustomersIndexRedirectUi from "@/components/page-ui/customers/customers-ui"; // Extracted presentation layer.
export async function getServerSideProps() {return {
    redirect: {
      destination: "/customer",
      permanent: false
    }
  };
}

export default function CustomersIndexRedirect() {
  return <CustomersIndexRedirectUi view="section1" />;
}
