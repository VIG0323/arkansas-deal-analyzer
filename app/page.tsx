"use client";

import dynamic from "next/dynamic";

const BatchAnalyzer = dynamic(() => import("@/components/BatchAnalyzer"), {
  ssr: false,
  loading: () => (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      background: "#060e1a",
      color: "#4a6a8a",
      fontFamily: "sans-serif",
      fontSize: 14,
    }}>
      Loading...
    </div>
  ),
});

export default function Home() {
  return <BatchAnalyzer />;
}
