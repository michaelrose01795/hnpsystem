export async function getServerSideProps() {
  return {
    redirect: {
      destination: "/customer",
      permanent: false,
    },
  };
}

export default function CustomersIndexRedirect() {
  return null;
}
