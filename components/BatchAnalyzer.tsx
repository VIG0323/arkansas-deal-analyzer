"use client";

import { useState, useRef, useCallback } from "react";

// ─── SAMPLE DATA ──────────────────────────────────────────────────────────────
const SAMPLE_LISTINGS = `2847 Oak Ridge Dr, Little Rock, AR 72209 | $87,500 | 3bd/2ba | 1,420 sqft | Built 1978 | 74 days on market
Estate sale — property sold strictly as-is. Seller is motivated and needs to close quickly. Price recently reduced from $99,000. Bring all offers. Home needs TLC — cosmetic updates throughout. Original kitchen and bathrooms. New roof 2021. HVAC serviced 2023.
---
1103 Maple Street, North Little Rock, AR 72114 | $62,000 | 3bd/1ba | 1,180 sqft | Built 1965 | 112 days on market
Must sell — owner relocated out of state. Investor special! Fixer upper with great potential. Needs updating throughout but solid structure. Great rental area near schools and shopping. All reasonable offers considered.
---
4521 Chenal Pkwy, Little Rock, AR 72223 | $148,000 | 4bd/2.5ba | 2,100 sqft | Built 1995 | 45 days on market
Beautiful home in desirable Chenal area needing cosmetic updates only. Price recently reduced. Open to creative financing. Great school district, strong appreciation area. Bring all offers — seller motivated to move.
---
715 Kavanaugh Blvd, Little Rock, AR 72205 | $74,000 | 3bd/2ba | 1,650 sqft | Built 1952 | 88 days on market
Needs TLC — sold as-is. Great Heights location. Property vacant 8 months. Needs full renovation but priced accordingly. Investor opportunity in one of Little Rock's most sought-after neighborhoods.
---
2240 Springer Blvd, Jacksonville, AR 72076 | $54,000 | 3bd/1ba | 1,090 sqft | Built 1971 | 28 days on market
Clean home needing cosmetic updates only. Great rental market area near LRAFB. Strong tenant demand. Tenant history available upon request. Move-in ready with minor work.`;

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = (n: number | null | undefined): string =>
  n == null || isNaN(n) ? "—" : "$" + Math.round(n).toLocaleString();
const pct = (n: number | null | undefined): string =>
  n == null || isNaN(n) ? "—" : n.toFixed(1) + "%";

const VERDICT_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  GO:    { bg: "#021a0e", border: "#059669", text: "#10b981" },
  MAYBE: { bg: "#1a1200", border: "#d97706", text: "#fbbf24" },
  "NO-GO": { bg: "#1a0505", border: "#dc2626", text: "#f87171" },
};
const STRAT_COLOR: Record<string, string> = {
  flip: "#3b82f6", rental: "#8b5cf6", ownerFinance: "#f59e0b",
};
const STRAT_LABEL: Record<string, string> = {
  flip: "Fix & Flip", rental: "Rental", ownerFinance: "Owner Finance",
};
const REHAB_COLOR: Record<string, string> = {
  Cosmetic: "#10b981", Light: "#3b82f6", Medium: "#fbbf24", Heavy: "#f87171",
};

function scoreColor(s: number): string {
  if (s >= 75) return "#10b981";
  if (s >= 55) return "#fbbf24";
  return "#f87171";
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, "").toLowerCase());
  return lines.slice(1).map((line) => {
    const vals = line.match(/(".*?"|[^,]+)/g) || [];
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (vals[i] || "").replace(/"/g, "").trim(); });
    return row;
  }).filter((r) => Object.values(r).some((v) => v));
}

function csvRowToListing(row: Record<string, string>): string {
  const addr = row["address"] || row["street address"] || row["property address"] || "";
  const city = row["city"] || "";
  const state = row["state"] || "AR";
  const zip = row["zip"] || row["zip code"] || row["postal code"] || "";
  const price = row["price"] || row["list price"] || row["listing price"] || "";
  const beds = row["beds"] || row["bedrooms"] || "";
  const baths = row["baths"] || row["bathrooms"] || "";
  const sqft = row["sqft"] || row["sq ft"] || row["square feet"] || row["living area"] || "";
  const yearBuilt = row["year built"] || row["yr built"] || "";
  const dom = row["days on market"] || row["dom"] || "";
  const desc = row["description"] || row["remarks"] || row["listing remarks"] || "";
  return `${addr}${city ? ", " + city : ""}${state ? ", " + state : ""}${zip ? " " + zip : ""} | ${price ? "$" + price.replace(/[$,]/g, "") : "Price N/A"} | ${beds}bd/${baths}ba | ${sqft} sqft${yearBuilt ? " | Built " + yearBuilt : ""}${dom ? " | " + dom + " days on market" : ""}${desc ? "\n" + desc : ""}`;
}

function splitListings(text: string): string[] {
  let parts = text.split(/\n---+\n/).map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1) return parts;
  parts = text.split(/\n{3,}/).map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1) return parts;
  return [text.trim()].filter(Boolean);
}

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface AnalysisResult {
  _index: number;
  address: string;
  city: string;
  zip: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  dom?: number;
  verdict: string;
  dealScore: number;
  verdictReason: string;
  scoreBreakdown: Record<string, number>;
  arv: { estimate: number; lowEnd: number; highEnd: number; pricePerSqft: number; confidence: string; basis: string };
  rehab: { condition: string; costLow: number; costHigh: number; keyItems: string[] };
  motivation: { score: number; flags: string[]; assessment: string };
  mao: { flip: number; rental: number; ownerFinance: number; controlling: number; controllingExit: string };
  flip: { viable: boolean; estimatedProfit: number; roi: number; timelineMonths: number; verdict: string };
  rental: { viable: boolean; marketRent: number; monthlyCashFlow: number; capRate: number; verdict: string };
 ownerFinance: { viable: boolean; resalePrice: number; downPaymentLow: number; downPaymentHigh: number; downPaymentPctLow: number; downPaymentPctHigh: number; monthlyPayment: number; netProfit: number; monthlyYield: number; verdict: string };
  topStrategy: string;
  topStrategyReason: string;
  greenFlags: string[];
  redFlags: string[];
  negotiationTips: string[];
  nextSteps: string[];
  decisionBar: { offerPrice: number; walkAwayPrice: number; bestExit: string; listVsOffer: string };
}
// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function BatchAnalyzer() {
  const [mode, setMode] = useState<"paste" | "csv">("paste");
  const [pasteText, setPasteText] = useState("");
  const [csvData, setCsvData] = useState<Record<string, string>[] | null>(null);
  const [csvFileName, setCsvFileName] = useState("");
  const [maoFlip, setMaoFlip] = useState(70);
  const [maoRental, setMaoRental] = useState(75);
  const [maoOF, setMaoOF] = useState(68);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [expanded, setExpanded] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<Record<number, string>>({});
  const [sortCol, setSortCol] = useState("dealScore");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [filterVerdict, setFilterVerdict] = useState("all");
  const [errors, setErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const onFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target?.result as string);
      setCsvData(rows);
    };
    reader.readAsText(file);
  }, []);

  const buildListings = (): string[] => {
    if (mode === "csv" && csvData) {
      return csvData.map(csvRowToListing).filter((s) => s.length > 20);
    }
    return splitListings(pasteText);
  };

  const analyzeOne = async (listingText: string, index: number) => {
    try {
      const resp = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing: listingText, maoFlip, maoRental, maoOF }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        return { ok: false, index, error: err.error || "Unknown error" };
      }
      const parsed = await resp.json();
      parsed._index = index;
      return { ok: true, data: parsed as AnalysisResult };
    } catch (err) {
      return { ok: false, index, error: String(err) };
    }
  };

  const runAnalysis = async () => {
    const listings = buildListings();
    if (!listings.length) return;
    setAnalyzing(true);
    setResults([]);
    setErrors([]);
    setExpanded(null);
    setProgress({ current: 0, total: listings.length });

    const batchResults: AnalysisResult[] = [];
    const batchErrors: string[] = [];

    for (let i = 0; i < listings.length; i++) {
      setProgress({ current: i + 1, total: listings.length });
      const res = await analyzeOne(listings[i], i);
      if (res.ok && res.data) {
        batchResults.push(res.data);
        setResults([...batchResults].sort((a, b) => b.dealScore - a.dealScore));
      } else {
        batchErrors.push(`Listing ${i + 1}: ${(res as { ok: false; error: string }).error}`);
      }
      if (i < listings.length - 1) await new Promise((r) => setTimeout(r, 600));
    }

    setErrors(batchErrors);
    setAnalyzing(false);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
  };

  const sorted = [...results]
    .filter((r) => filterVerdict === "all" || r.verdict === filterVerdict)
    .sort((a, b) => {
      const map: Record<string, [number, number]> = {
        dealScore: [b.dealScore, a.dealScore],
        price: [a.price, b.price],
        arv: [b.arv?.estimate ?? 0, a.arv?.estimate ?? 0],
        motivation: [b.motivation?.score ?? 0, a.motivation?.score ?? 0],
        dom: [b.dom ?? 0, a.dom ?? 0],
      };
      const [va, vb] = map[sortCol] || [b.dealScore, a.dealScore];
      return sortDir === "desc" ? va - vb : vb - va;
    });

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortCol(col); setSortDir("desc"); }
  };

  const listingCount =
    mode === "csv" ? (csvData?.length || 0) : splitListings(pasteText).filter(Boolean).length;

  return (
    <div style={{ fontFamily: "'Outfit', system-ui, sans-serif", background: "#060e1a", minHeight: "100vh", color: "#dce8f8" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 2px; }
        .card { background: #0b1828; border: 1px solid #162840; border-radius: 12px; }
        textarea:focus { outline: none; border-color: #2563eb !important; }
        .trow:hover { background: #0d1e35 !important; }
        .tab { background: none; border: none; cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 600; padding: 8px 16px; border-radius: 6px; transition: all 0.15s; letter-spacing: 0.04em; }
        .mode-btn { background: none; border: 1px solid #162840; cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 600; padding: 9px 20px; border-radius: 8px; transition: all 0.2s; color: #4a6a8a; }
        .mode-btn.active { background: #0f2a4a; border-color: #2563eb; color: #60a5fa; }
        .analyze-btn { background: linear-gradient(135deg,#1d4ed8,#0ea5e9); border: none; color: white; font-family: inherit; font-weight: 800; font-size: 15px; padding: 14px 36px; border-radius: 10px; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 28px rgba(14,165,233,.3); }
        .analyze-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 36px rgba(14,165,233,.45); }
        .analyze-btn:disabled { opacity: .5; cursor: not-allowed; }
        .sort-th { cursor: pointer; user-select: none; white-space: nowrap; }
        .sort-th:hover { color: #60a5fa !important; }
        .pill { display: inline-flex; align-items: center; padding: 2px 9px; border-radius: 99px; font-size: 10px; font-weight: 700; letter-spacing: .06em; }
        .fade-in { animation: fadeIn .4s ease-out; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .spin { animation: spin 1s linear infinite; display:inline-block; }
        @keyframes spin { to { transform:rotate(360deg); } }
        .expand-row { animation: expandIn .25s ease-out; }
        @keyframes expandIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
        input[type=range] { -webkit-appearance:none; height:4px; border-radius:2px; background:#162840; outline:none; cursor:pointer; width:100%; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:14px; height:14px; border-radius:50%; background:#2563eb; border:2px solid #1d4ed8; }
        .upload-zone { border: 2px dashed #162840; border-radius: 12px; padding: 40px; text-align: center; cursor: pointer; transition: all .2s; }
        .upload-zone:hover { border-color: #2563eb; background: #0a1628; }
      `}</style>

      {/* HEADER */}
      <div style={{ background: "#040b14", borderBottom: "1px solid #162840", padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 54 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 34, height: 34, background: "linear-gradient(135deg,#1d4ed8,#0ea5e9)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900 }}>⬡</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em" }}>Arkansas Deal Analyzer</div>
            <div style={{ fontSize: 10, color: "#3a5a7a", letterSpacing: ".08em" }}>AI-POWERED · CENTRAL ARKANSAS</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {results.length > 0 && (
            <span style={{ fontSize: 12, color: "#4a6a8a" }}>
              <span style={{ color: "#10b981", fontWeight: 700 }}>{results.filter((r) => r.verdict === "GO").length} GO</span>
              {" · "}
              <span style={{ color: "#fbbf24", fontWeight: 700 }}>{results.filter((r) => r.verdict === "MAYBE").length} MAYBE</span>
              {" · "}
              <span style={{ color: "#f87171", fontWeight: 700 }}>{results.filter((r) => r.verdict === "NO-GO").length} NO-GO</span>
            </span>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
            <span style={{ fontSize: 11, color: "#3a5a7a" }}>Claude AI</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px" }}>

        {/* INPUT PANEL */}
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <button className={`mode-btn ${mode === "paste" ? "active" : ""}`} onClick={() => setMode("paste")}>✎ Paste Listings</button>
            <button className={`mode-btn ${mode === "csv" ? "active" : ""}`} onClick={() => setMode("csv")}>⬆ Upload CSV</button>
            {mode === "paste" && (
              <button onClick={() => setPasteText(SAMPLE_LISTINGS)}
                style={{ marginLeft: "auto", background: "#0f2238", border: "1px solid #1a3a5c", color: "#4a90d9", fontSize: 11, fontFamily: "inherit", fontWeight: 600, padding: "6px 14px", borderRadius: 6, cursor: "pointer" }}>
                Load Sample Listings
              </button>
            )}
          </div>

          {mode === "paste" && (
            <div>
              <div style={{ fontSize: 12, color: "#4a6a8a", marginBottom: 10, lineHeight: 1.6 }}>
                Paste multiple listings separated by <code style={{ background: "#0f2238", padding: "1px 6px", borderRadius: 4, color: "#60a5fa" }}>---</code> on its own line.
              </div>
              <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)}
                placeholder={"123 Main St, Little Rock, AR 72201 | $85,000 | 3bd/2ba | 1,400 sqft\nEstate sale, as-is...\n---\n456 Oak Ave, NLR, AR 72114 | $62,000 | 3bd/1ba | 1,100 sqft\nMust sell..."}
                style={{ width: "100%", minHeight: 180, background: "#060f1c", border: "1px solid #162840", borderRadius: 10, padding: "14px 16px", color: "#c8d8f0", fontSize: 12, lineHeight: 1.8, fontFamily: "'JetBrains Mono',monospace", resize: "vertical", transition: "border-color .2s" }} />
              {listingCount > 0 && <div style={{ marginTop: 8, fontSize: 12, color: "#10b981" }}>✓ {listingCount} listing{listingCount !== 1 ? "s" : ""} detected</div>}
            </div>
          )}

          {mode === "csv" && (
            <div>
              <div style={{ fontSize: 12, color: "#4a6a8a", marginBottom: 12, lineHeight: 1.6 }}>
                Export search results from <strong style={{ color: "#8aa4c4" }}>CARMLS, Zillow, or Redfin</strong> as CSV and upload here.
              </div>
              <div className="upload-zone" onClick={() => fileRef.current?.click()}>
                <input ref={fileRef} type="file" accept=".csv" onChange={onFileUpload} style={{ display: "none" }} />
                {csvData ? (
                  <div>
                    <div style={{ fontSize: 20, marginBottom: 8 }}>✓</div>
                    <div style={{ fontWeight: 700, color: "#10b981", fontSize: 14 }}>{csvFileName}</div>
                    <div style={{ fontSize: 12, color: "#4a6a8a", marginTop: 4 }}>{csvData.length} properties loaded · click to replace</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.4 }}>⬆</div>
                    <div style={{ fontWeight: 600, color: "#8aa4c4", fontSize: 14 }}>Click to upload CSV</div>
                    <div style={{ fontSize: 12, color: "#3a5a7a", marginTop: 4 }}>Export from CARMLS · Zillow · Redfin · Realtor.com</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MAO SLIDERS */}
          <div style={{ marginTop: 20, padding: 18, background: "#060f1c", borderRadius: 10, border: "1px solid #111e2e" }}>
            <div style={{ fontSize: 10, color: "#3a5a7a", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 14, fontWeight: 600 }}>MAO Targets</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
              {[
                { label: "Fix & Flip", val: maoFlip, set: setMaoFlip, color: "#3b82f6" },
                { label: "Rental", val: maoRental, set: setMaoRental, color: "#8b5cf6" },
                { label: "Owner Finance", val: maoOF, set: setMaoOF, color: "#f59e0b" },
              ].map((s) => (
                <div key={s.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: "#8aa4c4" }}>{s.label}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: s.color, fontFamily: "'JetBrains Mono'" }}>{s.val}%</span>
                  </div>
                  <input type="range" min={60} max={85} step={5} value={s.val} onChange={(e) => s.set(+e.target.value)} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#2a4060", marginTop: 4 }}>
                    <span>60%</span><span>85%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
            <div style={{ fontSize: 12, color: "#3a5a7a" }}>
              {analyzing
                ? <span style={{ color: "#60a5fa" }}><span className="spin">⟳</span> Analyzing {progress.current} of {progress.total}...</span>
                : listingCount > 0 ? <span style={{ color: "#4a8a5a" }}>Ready — {listingCount} propert{listingCount !== 1 ? "ies" : "y"}</span>
                : "Add listings above to get started"}
            </div>
            <button className="analyze-btn" onClick={runAnalysis} disabled={analyzing || listingCount === 0}>
              {analyzing
                ? <span style={{ display: "flex", alignItems: "center", gap: 10 }}><span className="spin">⟳</span> Analyzing {progress.current}/{progress.total}…</span>
                : `⚡ Analyze ${listingCount > 0 ? listingCount + " " : ""}Deal${listingCount !== 1 ? "s" : ""}`}
            </button>
          </div>

          {analyzing && (
            <div style={{ marginTop: 14, height: 4, background: "#162840", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", background: "linear-gradient(90deg,#1d4ed8,#0ea5e9)", borderRadius: 2, width: `${(progress.current / progress.total) * 100}%`, transition: "width .4s ease-out" }} />
            </div>
          )}

          {errors.length > 0 && (
            <div style={{ marginTop: 12, padding: 12, background: "#1a0505", border: "1px solid #7f1d1d", borderRadius: 8, fontSize: 12, color: "#fca5a5" }}>
              {errors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
        </div>

        {/* RESULTS */}
        {results.length > 0 && (
          <div ref={resultsRef} className="fade-in">
            {/* SUMMARY */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 16 }}>
              {[
                { label: "Analyzed", value: results.length, color: "#dce8f8" },
                { label: "GO Deals", value: results.filter((r) => r.verdict === "GO").length, color: "#10b981" },
                { label: "Top Score", value: Math.max(...results.map((r) => r.dealScore)), color: "#60a5fa" },
                { label: "Avg Discount", value: (() => { const d = results.filter((r) => r.arv?.estimate && r.price).map((r) => ((r.arv.estimate - r.price) / r.arv.estimate) * 100); return d.length ? d.reduce((a, b) => a + b, 0) / d.length : null; })(), color: "#34d399", isPct: true },
                { label: "Best Flip MAO", value: Math.max(...results.map((r) => r.mao?.flip || 0)), color: "#a78bfa", isFmt: true },
              ].map((c, i) => (
                <div key={i} className="card" style={{ padding: "14px 16px" }}>
                  <div style={{ fontSize: 10, color: "#3a5a7a", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>{c.label}</div>
                  <div style={{ fontWeight: 800, fontSize: 22, color: c.color, fontFamily: "'Outfit'" }}>
                    {c.isFmt ? fmt(c.value as number) : c.isPct ? pct(c.value as number) : c.value}
                  </div>
                </div>
              ))}
            </div>

            {/* FILTER */}
            <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#3a5a7a", letterSpacing: ".08em" }}>SHOW:</span>
              {["all", "GO", "MAYBE", "NO-GO"].map((v) => (
                <button key={v} onClick={() => setFilterVerdict(v)}
                  style={{ background: filterVerdict === v ? (v === "GO" ? "#021a0e" : v === "MAYBE" ? "#1a1200" : v === "NO-GO" ? "#1a0505" : "#0f2a4a") : "none",
                    border: `1px solid ${filterVerdict === v ? (v === "GO" ? "#059669" : v === "MAYBE" ? "#d97706" : v === "NO-GO" ? "#dc2626" : "#2563eb") : "#162840"}`,
                    color: filterVerdict === v ? (v === "GO" ? "#10b981" : v === "MAYBE" ? "#fbbf24" : v === "NO-GO" ? "#f87171" : "#60a5fa") : "#4a6a8a",
                    fontFamily: "inherit", fontSize: 11, fontWeight: 700, padding: "5px 14px", borderRadius: 6, cursor: "pointer" }}>
                  {v === "all" ? `ALL (${results.length})` : `${v} (${results.filter((r) => r.verdict === v).length})`}
                </button>
              ))}
              <div style={{ marginLeft: "auto", fontSize: 11, color: "#3a5a7a" }}>{sorted.length} showing</div>
            </div>

            {/* TABLE */}
            <div className="card" style={{ overflow: "hidden", marginBottom: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#060f1c", borderBottom: "1px solid #162840" }}>
                    {[
                      { key: "dealScore", label: "Score" }, { key: null, label: "Verdict" }, { key: null, label: "Address" },
                      { key: "price", label: "Price" }, { key: "arv", label: "ARV" }, { key: null, label: "Discount" },
                      { key: null, label: "Rehab" }, { key: null, label: "MAO (Flip)" }, { key: null, label: "Strategy" },
                      { key: "dom", label: "DOM" }, { key: "motivation", label: "Motivation" }, { key: null, label: "" },
                    ].map((col, i) => (
                      <th key={i} onClick={col.key ? () => handleSort(col.key!) : undefined}
                        className={col.key ? "sort-th" : ""}
                        style={{ padding: "10px 12px", textAlign: "left", fontSize: 10, color: sortCol === col.key ? "#60a5fa" : "#3a5a7a", letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 600 }}>
                        {col.label}{col.key && (sortCol === col.key ? (sortDir === "desc" ? " ↓" : " ↑") : " ↕")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.flatMap((r, i) => {
                    const vc = VERDICT_STYLE[r.verdict] || VERDICT_STYLE["MAYBE"];
                    const discountPct = r.arv?.estimate && r.price ? ((r.arv.estimate - r.price) / r.arv.estimate) * 100 : null;
                    const isExpanded = expanded === r._index;
                    const tab = activeTab[r._index] || r.topStrategy || "flip";
                    return [
                      <tr key={`row-${r._index}`} className="trow"
                        onClick={() => setExpanded(isExpanded ? null : r._index)}
                        style={{ borderBottom: isExpanded ? "none" : "1px solid #0e1c2e", cursor: "pointer", background: i % 2 === 0 ? "#0b1828" : "#080f1c" }}>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ width: 42, height: 42, borderRadius: 8, background: scoreColor(r.dealScore) + "18", border: `1px solid ${scoreColor(r.dealScore)}40`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 16, color: scoreColor(r.dealScore), fontFamily: "'Outfit'" }}>{r.dealScore}</div>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <span className="pill" style={{ background: vc.bg, border: `1px solid ${vc.border}`, color: vc.text }}>{r.verdict}</span>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ fontSize: 13, color: "#dce8f8", fontWeight: 500 }}>{r.address}</div>
                          <div style={{ fontSize: 10, color: "#3a5a7a" }}>{r.city} · {r.beds}bd/{r.baths}ba · {r.sqft?.toLocaleString()} sqft</div>
                        </td>
                        <td style={{ padding: "10px 12px", fontWeight: 700, fontSize: 13, color: "#dce8f8", fontFamily: "'JetBrains Mono'" }}>{fmt(r.price)}</td>
                        <td style={{ padding: "10px 12px", color: "#60a5fa", fontSize: 13, fontFamily: "'JetBrains Mono'" }}>{fmt(r.arv?.estimate)}</td>
                        <td style={{ padding: "10px 12px" }}>
                          {discountPct != null && (
                            <span style={{ fontWeight: 700, fontSize: 13, color: discountPct >= 15 ? "#10b981" : discountPct >= 8 ? "#fbbf24" : "#f87171", fontFamily: "'JetBrains Mono'" }}>-{discountPct.toFixed(1)}%</span>
                          )}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <span className="pill" style={{ background: (REHAB_COLOR[r.rehab?.condition] || "#888") + "18", border: `1px solid ${(REHAB_COLOR[r.rehab?.condition] || "#888")}40`, color: REHAB_COLOR[r.rehab?.condition] || "#888" }}>{r.rehab?.condition || "—"}</span>
                        </td>
                        <td style={{ padding: "10px 12px", color: "#7dd3a8", fontSize: 13, fontFamily: "'JetBrains Mono'" }}>{fmt(r.mao?.flip)}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ fontSize: 11, color: STRAT_COLOR[r.topStrategy], background: (STRAT_COLOR[r.topStrategy] || "#888") + "18", padding: "3px 8px", borderRadius: 99, fontWeight: 600 }}>{STRAT_LABEL[r.topStrategy] || "—"}</span>
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: (r.dom ?? 0) > 60 ? "#10b981" : "#8aa4c4", fontFamily: "'JetBrains Mono'" }}>{r.dom != null ? r.dom + "d" : "—"}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ display: "flex", gap: 2 }}>
                            {[...Array(10)].map((_, j) => (
                              <div key={j} style={{ width: 5, height: 12, borderRadius: 2, background: j < (r.motivation?.score || 0) ? "#fbbf24" : "#162840" }} />
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: "10px 12px", color: "#3a5a7a", fontSize: 16 }}>{isExpanded ? "▲" : "▼"}</td>
                      </tr>,

                      isExpanded ? (
                        <tr key={`expand-${r._index}`} style={{ borderBottom: "1px solid #0e1c2e" }}>
                          <td colSpan={12} style={{ padding: 0, background: "#070e1c" }}>
                            <div className="expand-row" style={{ padding: "20px 20px 24px" }}>
                              <div style={{ display: "flex", gap: 6, marginBottom: 18, borderBottom: "1px solid #162840", paddingBottom: 14 }}
                                {r.decisionBar && (
                          <div style={{ display: "flex", gap: 16, alignItems: "center", padding: "10px 16px", background: "#040c18", border: "1px solid #1e3a5f", borderRadius: 8, marginBottom: 16, flexWrap: "wrap" }}>
                            <div style={{ fontSize: 10, color: "#3a5a7a", letterSpacing: ".1em", fontWeight: 700 }}>DECISION</div>
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <span style={{ fontSize: 11, color: "#6a8aaa" }}>Offer</span>
                              <span style={{ fontSize: 15, fontWeight: 900, color: "#10b981", fontFamily: "'JetBrains Mono'" }}>{fmt(r.decisionBar?.offerPrice)}</span>
                            </div>
                            <div style={{ color: "#1e3a5f" }}>|</div>
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <span style={{ fontSize: 11, color: "#6a8aaa" }}>Walk Away</span>
                              <span style={{ fontSize: 15, fontWeight: 900, color: "#f87171", fontFamily: "'JetBrains Mono'" }}>{fmt(r.decisionBar?.walkAwayPrice)}</span>
                            </div>
                            <div style={{ color: "#1e3a5f" }}>|</div>
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <span style={{ fontSize: 11, color: "#6a8aaa" }}>Best Exit</span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: STRAT_COLOR[r.decisionBar?.bestExit] }}>{STRAT_LABEL[r.decisionBar?.bestExit]}</span>
                            </div>
                            <div style={{ marginLeft: "auto", fontSize: 11, color: "#fbbf24" }}>{r.decisionBar?.listVsOffer}</div>
                          </div>
                        )}
                                 {["flip", "rental", "ownerFinance"].map((s) => (
                                  <button key={s} className="tab"
                                    onClick={(e) => { e.stopPropagation(); setActiveTab((t) => ({ ...t, [r._index]: s })); }}
                                    style={{ color: tab === s ? "white" : "#4a6a8a", background: tab === s ? STRAT_COLOR[s] + "22" : "none", border: tab === s ? `1px solid ${STRAT_COLOR[s]}50` : "1px solid transparent" }}>
                                    {s === r.topStrategy && "★ "}{STRAT_LABEL[s]}
                                  </button>
                                ))}
                                <div style={{ marginLeft: "auto", fontSize: 12, color: "#6a8aaa" }}>{r.arv?.basis}</div>
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
                                {/* Numbers */}
                                <div style={{ background: "#060e1a", border: "1px solid #162840", borderRadius: 10, padding: 16 }}>
                                  <div style={{ fontSize: 10, color: "#3a5a7a", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 12, fontWeight: 600 }}>{STRAT_LABEL[tab]} Numbers</div>
                                  {tab === "flip" && [
                                    { l: "MAO (Flip)", v: fmt(r.mao?.flip), hi: true },
                                    { l: "Rehab Range", v: `${fmt(r.rehab?.costLow)} – ${fmt(r.rehab?.costHigh)}` },
                                    { l: `Timeline`, v: `~${r.flip?.timelineMonths || "—"} months` },
                                    { l: "Est. Net Profit", v: fmt(r.flip?.estimatedProfit), accent: "#10b981" },
                                    { l: "ROI", v: pct(r.flip?.roi), accent: "#10b981" },
                                  ].map((row, j) => (
                                    <div key={j} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #111e2e" }}>
                                      <span style={{ fontSize: 12, color: "#6a8aaa" }}>{row.l}</span>
                                      <span style={{ fontSize: 13, fontWeight: 700, color: row.accent || (row.hi ? "#60a5fa" : "#dce8f8"), fontFamily: "'JetBrains Mono'" }}>{row.v}</span>
                                    </div>
                                  ))}
                                  {tab === "rental" && [
                                    { l: "Market Rent", v: fmt(r.rental?.marketRent) + "/mo", hi: true },
                                    { l: "Cash Flow", v: fmt(r.rental?.monthlyCashFlow) + "/mo", accent: (r.rental?.monthlyCashFlow ?? 0) >= 0 ? "#10b981" : "#f87171" },
                                    { l: "Cap Rate", v: pct(r.rental?.capRate) },
                                    { l: "Rental MAO", v: fmt(r.mao?.rental) },
                                  ].map((row, j) => (
                                    <div key={j} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #111e2e" }}>
                                      <span style={{ fontSize: 12, color: "#6a8aaa" }}>{row.l}</span>
                                      <span style={{ fontSize: 13, fontWeight: 700, color: row.accent || (row.hi ? "#60a5fa" : "#dce8f8"), fontFamily: "'JetBrains Mono'" }}>{row.v}</span>
                                    </div>
                                  ))}
                              {tab === "ownerFinance" && [
                                    { l: "Resale Price", v: fmt(r.ownerFinance?.resalePrice), hi: true },
                                    { l: "Down Payment (Low)", v: fmt(r.ownerFinance?.downPaymentLow) + ` (${r.ownerFinance?.downPaymentPctLow ?? 0}%)`, accent: "#10b981" },
                                    { l: "Down Payment (High)", v: fmt(r.ownerFinance?.downPaymentHigh) + ` (${r.ownerFinance?.downPaymentPctHigh ?? 0}%)`, accent: "#10b981" },
                                    { l: "Buyer Payment", v: fmt(r.ownerFinance?.monthlyPayment) + "/mo" },
                                    { l: "Monthly Yield", v: pct(r.ownerFinance?.monthlyYield) },
                                    { l: "Net Profit", v: fmt(r.ownerFinance?.netProfit), accent: "#fbbf24" },
                                    { l: "Controlling MAO", v: fmt(r.mao?.controlling), hi: true },
                                  ].map((row, j) => (
                                    <div key={j} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #111e2e" }}>
                                      <span style={{ fontSize: 12, color: "#6a8aaa" }}>{row.l}</span>
                                      <span style={{ fontSize: 13, fontWeight: 700, color: row.accent || (row.hi ? "#60a5fa" : "#dce8f8"), fontFamily: "'JetBrains Mono'" }}>{row.v}</span>
                                    </div>
                                  ))}
                                  <div style={{ marginTop: 12, padding: 10, background: "#0a1828", borderRadius: 8, fontSize: 12, color: "#8aa4c4", lineHeight: 1.6 }}>
                                    {(r as unknown as Record<string, Record<string, string>>)[tab]?.verdict}
                                  </div>
                                </div>
                                {/* Flags */}
                                <div style={{ background: "#060e1a", border: "1px solid #162840", borderRadius: 10, padding: 16 }}>
                                  <div style={{ fontSize: 10, color: "#3a5a7a", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 12, fontWeight: 600 }}>Flags & Signals</div>
                                  {r.greenFlags?.map((f, j) => <div key={j} style={{ fontSize: 11, color: "#6ee7b7", background: "#021a0e", border: "1px solid #065f46", borderRadius: 5, padding: "3px 9px", display: "inline-block", marginRight: 5, marginBottom: 5 }}>✓ {f}</div>)}
                                  {r.redFlags?.map((f, j) => <div key={j} style={{ fontSize: 11, color: "#fca5a5", background: "#1a0505", border: "1px solid #7f1d1d", borderRadius: 5, padding: "3px 9px", display: "inline-block", marginRight: 5, marginBottom: 5 }}>⚠ {f}</div>)}
                                  {r.motivation?.flags?.length > 0 && <>
                                    <div style={{ fontSize: 10, color: "#3a5a7a", marginTop: 8, marginBottom: 6 }}>MOTIVATION</div>
                                    {r.motivation.flags.map((f, j) => <div key={j} style={{ fontSize: 11, color: "#fcd34d", background: "#1a1000", border: "1px solid #78350f", borderRadius: 5, padding: "3px 9px", display: "inline-block", marginRight: 5, marginBottom: 5 }}>⚡ {f}</div>)}
                                  </>}
                                  <div style={{ marginTop: 12, fontSize: 12, color: "#8aa4c4", lineHeight: 1.6 }}>{r.verdictReason}</div>
                                </div>
                                {/* Next Steps */}
                                <div style={{ background: "#060e1a", border: "1px solid #162840", borderRadius: 10, padding: 16 }}>
                                  <div style={{ fontSize: 10, color: "#3a5a7a", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 12, fontWeight: 600 }}>Next Steps</div>
                                  {r.negotiationTips?.map((tip, j) => (
                                    <div key={j} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                                      <div style={{ width: 20, height: 20, borderRadius: 5, background: "#0f2238", border: "1px solid #1a3a5c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#4a90d9", flexShrink: 0, fontWeight: 700 }}>N</div>
                                      <div style={{ fontSize: 12, color: "#c8d8f0", lineHeight: 1.5 }}>{tip}</div>
                                    </div>
                                  ))}
                                  {r.nextSteps?.map((step, j) => (
                                    <div key={j} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                                      <div style={{ width: 20, height: 20, borderRadius: 5, background: "#021a0e", border: "1px solid #065f46", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#6ee7b7", flexShrink: 0, fontWeight: 700 }}>{j + 1}</div>
                                      <div style={{ fontSize: 12, color: "#c8d8f0", lineHeight: 1.5 }}>{step}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null,
                    ];
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ textAlign: "center", padding: "20px 0 8px" }}>
              <button onClick={() => { setResults([]); setPasteText(""); setCsvData(null); setCsvFileName(""); setExpanded(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                style={{ background: "none", border: "1px solid #162840", color: "#3a5a7a", fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: "9px 22px", borderRadius: 8, cursor: "pointer" }}>
                ← Start New Batch
              </button>
            </div>
          </div>
        )}

        {!results.length && !analyzing && (
          <div style={{ textAlign: "center", padding: "50px 24px", color: "#1e3a5a" }}>
            <div style={{ fontSize: 52, marginBottom: 16, opacity: 0.3 }}>⬡</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#2a4a6a", marginBottom: 8 }}>Paste listings or upload a CSV to begin</div>
            <div style={{ fontSize: 13, color: "#1e3050", maxWidth: 420, margin: "0 auto", lineHeight: 1.6 }}>
              Separate multiple listings with <code style={{ background: "#0f2238", padding: "1px 6px", borderRadius: 3, color: "#4a90d9" }}>---</code> when pasting, or export a CSV directly from CARMLS, Zillow, or Redfin
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
