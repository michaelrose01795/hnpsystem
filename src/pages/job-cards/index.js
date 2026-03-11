export async function getServerSideProps() {
  return {
    redirect: {
      destination: "/job-cards/view",
      permanent: false,
    },
  };
}

export default function JobCardsIndexRedirect() {
  return null;
}
