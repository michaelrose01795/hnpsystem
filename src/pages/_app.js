// src/pages/_app.js
import '../styles/global.css'  // relative path from _app.js to global.css

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />
}
