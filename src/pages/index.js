// file location: src/pages/index.js
// Root entry redirects straight to /login. The login page handles any
// "already signed in" session check and forwards authenticated users on,
// so users land on the login screen first — not an intermediate redirect page.

export async function getServerSideProps() {
  return {
    redirect: {
      destination: "/login",
      permanent: false,
    },
  };
}

export default function HomeRedirect() {
  return null;
}
