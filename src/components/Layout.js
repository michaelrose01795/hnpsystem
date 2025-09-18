import Sidebar from "./Sidebar";
import Header from "./Header";

export default function Layout({ children }) {
  return (
    <div className="layout-container" style={{ display: "flex" }}>
      <Sidebar />
      <div style={{ flex: 1 }}>
        <Header />
        <main style={{ padding: "1rem" }}>{children}</main>
      </div>
    </div>
  );
}