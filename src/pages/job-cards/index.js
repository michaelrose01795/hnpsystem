// file location: src/pages/job-cards/index.js
import JobCardsIndexRedirectUi from "@/components/page-ui/job-cards/job-cards-ui"; // Extracted presentation layer.
export async function getServerSideProps() {return {
    redirect: {
      destination: "/jobs",
      permanent: false
    }
  };
}

export default function JobCardsIndexRedirect() {
  return <JobCardsIndexRedirectUi view="section1" />;
}
