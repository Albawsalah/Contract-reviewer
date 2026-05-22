import dynamic from "next/dynamic";

const ContractReviewer = dynamic(() => import("../components/ContractReviewer"), {
  ssr: false,
  loading: () => (
    <div style={{ minHeight: "100vh", background: "#0B0F1A", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#C9A84C", fontFamily: "Cairo, sans-serif", fontSize: "18px" }}>جارٍ التحميل...</div>
    </div>
  ),
});

export default function Page() {
  return <ContractReviewer />;
}
