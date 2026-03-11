export async function getServerSideProps() {
  return {
    redirect: {
      destination: "/workshop/consumables-tracker",
      permanent: false,
    },
  };
}

export default function WorkshopIndexRedirect() {
  return null;
}
