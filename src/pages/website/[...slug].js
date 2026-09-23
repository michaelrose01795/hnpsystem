// file location: src/pages/website/[...slug].js
//
// Catch-all for any /website address that has no page. Next.js matches every
// real /website route first, so only unknown addresses land here.
//
// It exists so a missing customer page is answered by the customer site itself
// — server-rendered with custglobal.css, the site's top bar and footer, and a
// real 404 status for crawlers — rather than falling through to the app-wide
// 404 page. `notFound: true` is deliberately NOT used: that would hand the
// request back to /404.
import { customerWebsiteGetLayout } from "@/components/layout/CustomerWebsiteLayout";
import WebsiteErrorPage from "@/features/website/errors/WebsiteErrorPage";

export default function WebsiteNotFound() {
  return <WebsiteErrorPage statusCode={404} />;
}

WebsiteNotFound.getLayout = customerWebsiteGetLayout;

export async function getServerSideProps({ res }) {
  res.statusCode = 404;
  return { props: {} };
}
