import React, { useState, useMemo, useEffect, useRef } from "react";
import SmilesDrawer from "smiles-drawer";
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, BarChart, Bar, Cell, ZAxis, PieChart, Pie, Legend,
} from "recharts";
import {
  Search, Download, Upload, FlaskConical, Database, Home,
  FileText, X, ArrowUpRight,
} from "lucide-react";
import Papa from "papaparse";
import csvText from "./lnpcd.csv?raw";
import UMAP from "./umap.json";

/* ───────────────────────── viability colormap ─────────────────────────
   The through-line of the whole app: viable → cytotoxic.
   teal (#0FA597) → amber (#E0A12E) → rose (#D14B6A)                        */
const hexToRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = (r, g, b) => "#" + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, "0")).join("");
const lerp = (a, b, t) => a + (b - a) * t;
function viabilityColor(v) {
  const stops = [[12, "#D14B6A"], [55, "#E0A12E"], [96, "#0FA597"]];
  const vv = Math.max(stops[0][0], Math.min(stops[2][0], v));
  let i = 0; while (i < stops.length - 1 && vv > stops[i + 1][0]) i++;
  const [v0, c0] = stops[i], [v1, c1] = stops[Math.min(i + 1, stops.length - 1)];
  const t = v1 === v0 ? 0 : (vv - v0) / (v1 - v0);
  const a = hexToRgb(c0), b = hexToRgb(c1);
  return toHex(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));
}

/* ───────────────────────── column map ───────────────────────── */
const COL = {
  lipidName:    "Lipid_name",
  smiles:       "smiles",
  helper:       "Helper_lipid_ID",
  ionRatio:     "Ionizable_Lipid_Mol_Ratio",
  phosphoRatio: "Helper_Lipid_Mol_Ratio",
  cholRatio:    "Cholesterol_Mol_Ratio",
  pegRatio:     "PEG_Lipid_Mol_Ratio",
  lipidToRNA:   "Ionizable_Lipid_to_mRNA_weight_ratio",
  cell:         "Model_type",
  cargo:        "Cargo_type",
  viability:    "viability",
  experiment:   "Experiment_ID",
  formulation:  "Formulation",
  numTails:     "Num_tails",
  carbons:      "Num_carbon_in_tail",
  unsatBonds:   "num_unsaturated_cc_bonds",
  protonN:      "num_protonatable_nitrogens",
  ref:          "paper_link",
};

const num = (x) => { const n = parseFloat(x); return Number.isFinite(n) ? n : null; };

const RAW = Papa.parse(csvText.trim(), { header: true, skipEmptyLines: true }).data
  .filter((r) => r[COL.lipidName])
  .map((r, i) => {
    const ionR  = parseFloat(r[COL.ionRatio])     || 0;
    const phoR  = parseFloat(r[COL.phosphoRatio]) || 0;
    const choR  = parseFloat(r[COL.cholRatio])    || 0;
    const pegR  = parseFloat(r[COL.pegRatio])     || 0;
    const fmt   = (x) => x % 1 === 0 ? String(x) : x.toFixed(1);
    const ratio = `${fmt(ionR)}:${fmt(phoR)}:${fmt(choR)}:${fmt(pegR)}`;
    return {
      id:          "LNPCD-" + String(i + 1).padStart(4, "0"),
      ionizable:   r[COL.lipidName]  || "—",
      smiles:      r[COL.smiles]     || "—",
      helper:      r[COL.helper]     || "—",
      ratio,
      ionPct:      ionR,
      phosphoRatio: phoR,
      cholRatio:   choR,
      pegRatio:    pegR,
      lipidToRNA:  num(r[COL.lipidToRNA]),
      cell:        r[COL.cell]       || "—",
      cargo:       r[COL.cargo]      || "—",
      viability:   Math.round((num(r[COL.viability]) ?? 0) * 1000) / 10,
      experiment:  r[COL.experiment] || "—",
      formulation: r[COL.formulation]|| "—",
      numTails:    num(r[COL.numTails]),
      carbons:     num(r[COL.carbons]),
      unsatBonds:  num(r[COL.unsatBonds]),
      protonN:     num(r[COL.protonN]),
      ref:         r[COL.ref]        || "—",
    };
  });

const CARGOS  = [...new Set(RAW.map((d) => d.cargo))];
const CELLS   = [...new Set(RAW.map((d) => d.cell))];
const HELPERS = [...new Set(RAW.map((d) => d.helper))];
/* normalized viability, 0–100% of untreated control */
const V_MAX = Math.ceil(Math.max(...RAW.map((d) => d.viability)));

/* ───────────────────────── downloads ───────────────────────── */
function downloadBlob(content, filename, type = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
const downloadDataset = () => downloadBlob(csvText, "lnpcd.csv");
const downloadTemplate = () => downloadBlob(csvText.trim().split(/\r?\n/)[0] + "\n", "lnpcd_template.csv");
const downloadJSON = () => downloadBlob(JSON.stringify(RAW, null, 2), "lnpcd.json", "application/json;charset=utf-8");

/* deterministic 96-well plate, dose-response gradient across columns */
const PLATE = Array.from({ length: 96 }, (_, i) => {
  const row = Math.floor(i / 12), col = i % 12;
  const v = 96 - col * 6.2 + Math.sin(row * 1.25) * 7 + (((i * 37) % 13) - 6);
  return Math.max(8, Math.min(99, v));
});

/* ───────────────────────── schema (docs) ───────────────────────── */
const SCHEMA = [
  ["Lipid_name",                        "string", "Ionizable lipid identifier (e.g. SM-102, MC3)", "req"],
  ["smiles",                            "SMILES", "Canonical SMILES of the ionizable lipid", "req"],
  ["Ionizable_Lipid_Mol_Ratio",         "number", "Ionizable lipid mole fraction in formulation", "req"],
  ["Helper_Lipid_Mol_Ratio",            "number", "Helper (phospholipid) mole fraction", "req"],
  ["Cholesterol_Mol_Ratio",             "number", "Cholesterol mole fraction", "req"],
  ["PEG_Lipid_Mol_Ratio",              "number", "PEG-lipid mole fraction", "req"],
  ["Helper_lipid_ID",                  "enum",   "Helper lipid identity: DOPE · DSPC · MDOA", "req"],
  ["Ionizable_Lipid_to_mRNA_weight_ratio", "number", "Lipid-to-RNA weight ratio", "req"],
  ["Model_type",                        "enum",   "Cell line: HeLa · HepG2 · IGROV1 · MDA_MB", "req"],
  ["Cargo_type",                        "enum",   "Nucleic acid cargo: mRNA · siRNA", "req"],
  ["unnormalized_toxicity",             "number", "Cell viability % vs. untreated control", "req"],
  ["Experiment_ID",                     "string", "Study identifier linking records to a publication", "req"],
  ["paper_link",                        "URL",    "DOI / journal link to source paper", "req"],
  ["Num_tails",                         "number", "Number of lipid tails on the ionizable lipid", "req"],
  ["Num_carbon_in_tail",               "number", "Carbon count per tail", "req"],
  ["num_unsaturated_cc_bonds",         "number", "Total C=C bonds across all tails", "req"],
  ["num_protonatable_nitrogens",       "number", "Count of protonatable nitrogen atoms", "req"],
  ["Lipid/Cells",                      "number", "Log-transformed ng of ionizable lipid per 1,000 cells", "req"],
  ["NA/Cells",                         "number", "Log-transformed ng of nucleic acid per 1,000 cells", "req"],
  ["lnMolWt",                          "number", "Log-transformed molecular weight", "req"],

];

function Pill({ children, tone = "ink" }) {
  return <span className={"pill pill-" + tone}>{children}</span>;
}

/* ───────────────────────── well plate (signature) ───────────────────────── */
function WellPlate() {
  const rows = "ABCDEFGH".split("");
  return (
    <div className="plate" role="img" aria-label="96-well microplate colored by cell viability">
      <div className="plate-colnums">
        <span />{Array.from({ length: 12 }, (_, c) => <span key={c}>{c + 1}</span>)}
      </div>
      {rows.map((rl, r) => (
        <div className="plate-row" key={rl}>
          <span className="plate-rowlabel">{rl}</span>
          {Array.from({ length: 12 }, (_, c) => {
            const idx = r * 12 + c;
            const v = PLATE[idx];
            return (
              <span
                key={c}
                className="well"
                style={{ "--wc": viabilityColor(v), animationDelay: idx * 11 + "ms" }}
                title={rl + (c + 1) + " · " + Math.round(v) + "% viable"}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────── nav ───────────────────────── */
function Nav({ view, setView }) {
  const items = [
    ["home", "Home", Home],
    ["database", "Database", Database],
    ["submit", "Submit", Upload],
    ["docs", "Docs", FileText],
  ];
  return (
    <header className="nav">
      <div className="brand" onClick={() => setView("home")}>
        <span className="brand-glyph"><FlaskConical size={18} strokeWidth={2.2} /></span>
        <span className="brand-word">LNPCD</span>
        <span className="brand-sub">Lipid Nanoparticle Cytotoxicity Database</span>
      </div>
      <nav className="nav-links">
        {items.map(([k, label, Icon]) => (
          <button key={k} className={"nav-link" + (view === k ? " is-active" : "")} onClick={() => setView(k)}>
            <Icon size={15} strokeWidth={2} /> {label}
          </button>
        ))}
      </nav>
    </header>
  );
}

/* ───────────────────────── hero + stats ───────────────────────── */
function Hero({ setView }) {
  const stats = [
    [RAW.length, "viability records"],
    [new Set(RAW.map((d) => d.ionizable)).size, "ionizable lipids"],
    [CELLS.length, "cell lines"],
    [11, "studies"],
  ];
  return (
    <section className="hero">
      <div className="hero-copy">
        <span className="eyebrow">Standardized · paired structure → viability</span>
        <h1>The cytotoxicity layer for<br />data-driven LNP design</h1>
        <p>
          Composition, dose, and assay conditions reconciled into one schema, so cell
          viability becomes searchable, plottable, and ready to train on — not buried in
          supplements.
        </p>
        <div className="hero-actions">
          <button className="btn btn-solid" onClick={downloadDataset}><Download size={15} /> Download dataset (CSV)</button>
          <button className="btn btn-ghost" onClick={() => setView("docs")}>Read the schema <ArrowUpRight size={15} /></button>
        </div>
      </div>
      <div className="hero-plate"><WellPlate /></div>
      <div className="stat-strip">
        {stats.map(([n, l], i) => (
          <div className="stat" key={l} style={{ animationDelay: i * 80 + "ms" }}>
            <b>{n}</b><span>{l}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── database view ───────────────────────── */
function ViabilityCell({ v }) {
  return (
    <span className="vcell">
      <span className="vdot" style={{ background: viabilityColor(v) }} />
      <span className="vnum">{v}%</span>
    </span>
  );
}

function DatabaseView() {
  const [q, setQ] = useState("");
  const [cargo, setCargo] = useState("all");
  const [cell, setCell] = useState("all");
  const [helper, setHelper] = useState("all");
  const [vmax, setVmax] = useState(V_MAX);
  const [sel, setSel] = useState(null);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return RAW.filter((d) =>
      (cargo  === "all" || d.cargo  === cargo) &&
      (cell   === "all" || d.cell   === cell) &&
      (helper === "all" || d.helper === helper) &&
      d.viability <= vmax &&
      (!t || [d.ionizable, d.cell, d.cargo, d.experiment, d.ref, d.id]
        .some((x) => x.toLowerCase().includes(t)))
    );
  }, [q, cargo, cell, helper, vmax]);

  return (
    <section className="panel-wrap">
      <div className="db-head">
        <h2 className="view-title">Database</h2>
        <div className="feat-strip">
          {[
            [Search, "Search & filter", `Slice ${RAW.length.toLocaleString()} curated viability records by cargo, cell line, helper lipid, and viability threshold.`],
            [FlaskConical, "Live structure diagrams", "Open any row to render the ionizable lipid as a 2D chemical structure, drawn on the fly from its SMILES."],
            [FileText, "Sourced & reproducible", "Every record carries its full formulation, assay context, and a direct link to the source publication."],
          ].map(([Icon, title, body], i) => (
            <div className="feat" key={title} style={{ animationDelay: i * 90 + "ms" }}>
              <div className="feat-ico"><Icon size={18} /></div>
              <b>{title}</b>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="controls">
        <div className="search">
          <Search size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search lipid, cell line, study…" />
        </div>
        <label className="ctrl">
          <span>Cargo</span>
          <select value={cargo} onChange={(e) => setCargo(e.target.value)}>
            <option value="all">All</option>{CARGOS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="ctrl">
          <span>Cell line</span>
          <select value={cell} onChange={(e) => setCell(e.target.value)}>
            <option value="all">All</option>{CELLS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="ctrl">
          <span>Helper lipid</span>
          <select value={helper} onChange={(e) => setHelper(e.target.value)}>
            <option value="all">All</option>{HELPERS.map((h) => <option key={h}>{h}</option>)}
          </select>
        </label>
        <label className="ctrl ctrl-range">
          <span>Viability ≤ <b>{vmax}%</b></span>
          <input type="range" min="0" max={V_MAX} value={vmax} onChange={(e) => setVmax(+e.target.value)} />
        </label>
        <span className="count">{rows.length} of {RAW.length}</span>
      </div>

      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>ID</th><th>Ionizable lipid</th><th>Cell line</th>
              <th>Cargo</th><th>Helper</th><th className="num">Ion mol %</th>
              <th>Viability</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} onClick={() => setSel(d)} tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setSel(d)}>
                <td className="mono dim">{d.id}</td>
                <td className="strong">{d.ionizable}</td>
                <td>{d.cell}</td>
                <td><span className="tag">{d.cargo}</span></td>
                <td><span className="tag">{d.helper}</span></td>
                <td className="num mono">{d.ionPct ? d.ionPct.toFixed(1) : "—"}</td>
                <td><ViabilityCell v={d.viability} /></td>
                <td className="chev"><ArrowUpRight size={14} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sel && <DetailDrawer d={sel} onClose={() => setSel(null)} />}
    </section>
  );
}

function StructureDiagram({ smiles }) {
  const ref = useRef(null);
  useEffect(() => {
    const host = ref.current;
    if (!smiles || smiles === "—" || !host) return;
    host.innerHTML = "";
    const drawer = new SmilesDrawer.SvgDrawer({ width: 380, height: 240, compactDrawing: false, padding: 14 });
    SmilesDrawer.parse(smiles, (tree) => {
      const svg = drawer.draw(tree, null, "light");
      if (svg) host.appendChild(svg);
    }, (err) => {
      host.innerHTML = '<span class="struct-fail">Structure could not be rendered from this SMILES.</span>';
      console.warn("SMILES render failed:", err);
    });
  }, [smiles]);
  if (!smiles || smiles === "—") return null;
  return <div ref={ref} className="struct-svg" />;
}

function DetailDrawer({ d, onClose }) {
  const field = (k, v, mono) => (
    <div className="field"><span>{k}</span><b className={mono ? "mono" : ""}>{v}</b></div>
  );
  const viabilityPct = Math.round(d.viability);
  return (
    <div className="drawer-scrim" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <span className="mono dim">{d.id} · {d.experiment}</span>
            <h3>{d.ionizable}</h3>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="readout">
          <div className="readout-ring" style={{ "--c": viabilityColor(viabilityPct), "--p": viabilityPct }}>
            <b>{viabilityPct}%</b><span>viable</span>
          </div>
          <div className="readout-meta">
            {field("Cell line", d.cell)}
            {field("Cargo", d.cargo)}
            {field("Formulation ID", d.formulation, true)}
          </div>
        </div>

        <h4>Formulation</h4>
        <div className="grid2">
          {field("Ionizable lipid", d.ionizable)}
          {field("Helper lipid", d.helper)}
          {field("Molar ratio (ion:helper:chol:PEG)", d.ratio, true)}
          {field("Lipid : nucleic acid", d.lipidToRNA != null ? d.lipidToRNA.toFixed(2) + " w/w" : "—", true)}
        </div>

        <h4>Structural features</h4>
        <div className="grid2">
          {field("Tails", d.numTails ?? "—", true)}
          {field("Carbons / tail", d.carbons ?? "—", true)}
          {field("C=C bonds", d.unsatBonds ?? "—", true)}
          {field("Protonatable N", d.protonN ?? "—", true)}
        </div>

        <h4>Structure</h4>
        <StructureDiagram smiles={d.smiles} />
        <div className="smiles">{d.smiles}</div>

        <h4>Provenance</h4>
        <div className="prov">
          {field("Study", d.experiment)}
          {d.ref && d.ref !== "—"
            ? <a className="btn btn-ghost sm" href={d.ref} target="_blank" rel="noreferrer">Open paper <ArrowUpRight size={13} /></a>
            : <button className="btn btn-ghost sm" disabled>No link</button>}
        </div>
      </aside>
    </div>
  );
}

/* ───────────────────────── overview (home charts) ───────────────────────── */
const axisStyle = { fontSize: 11, fontFamily: "IBM Plex Mono, monospace", fill: "#5C6E74" };
const tooltipStyle = { fontFamily: "IBM Plex Mono", fontSize: 11, borderRadius: 0, border: "1px solid #0D1B21" };
const CAT_COLORS = ["#0E8C82", "#E0A12E", "#D14B6A", "#3E7CB1", "#7A5C99", "#5C6E74"];

function ChartCard({ title, sub, children }) {
  return (
    <div className="chart-card">
      <div className="chart-head"><h4>{title}</h4><span>{sub}</span></div>
      <div className="chart-body">{children}</div>
    </div>
  );
}

const countBy = (key) => {
  const m = {};
  RAW.forEach((d) => { m[d[key]] = (m[d[key]] || 0) + 1; });
  return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
};

const scatterDot = (vKey) => (props) => {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={3.2} fill={viabilityColor(payload[vKey])} fillOpacity={0.72} stroke="rgba(13,27,33,.18)" strokeWidth={0.4} />;
};

function UmapTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="umap-tip">
      <b>{d.lipid}</b>
      <span className="dim">{d.exp}</span>
      <span>{d.cell} · {d.cargo} · {d.helper}</span>
      <span style={{ color: viabilityColor(d.v), fontWeight: 600 }}>{Math.round(d.v)}% viable</span>
    </div>
  );
}

function DonutCard({ title, sub, data }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ChartCard title={title} sub={sub}>
      <ResponsiveContainer width="100%" height={230}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78}
            paddingAngle={2} stroke="none" isAnimationActive={false}>
            {data.map((d, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle}
            formatter={(v, n) => [`${v} (${Math.round((v / total) * 100)}%)`, n]} />
          <Legend verticalAlign="bottom" height={28} iconType="circle"
            wrapperStyle={{ fontFamily: "IBM Plex Mono", fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function OverviewView() {
  const byCargo  = useMemo(() => countBy("cargo"), []);
  const byHelperN = useMemo(() => countBy("helper"), []);
  const byCell   = useMemo(() => countBy("cell"), []);
  const byHelperMean = useMemo(() => HELPERS.map((h) => {
    const sub = RAW.filter((d) => d.helper === h);
    return { name: h, mean: Math.round(sub.reduce((s, d) => s + d.viability, 0) / (sub.length || 1)) };
  }), []);

  return (
    <section className="overview">
      <DonutCard title="Cargo type" sub="records by payload" data={byCargo} />
      <DonutCard title="Helper lipid" sub="records by helper identity" data={byHelperN} />
      <DonutCard title="Cell line" sub="records by model" data={byCell} />

      <ChartCard title="Mean viability by helper lipid" sub="DOPE · DSPC · MDOA">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={byHelperMean} margin={{ top: 8, right: 12, bottom: 8, left: 4 }}>
            <CartesianGrid stroke="#D7E0E0" strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="name" tick={axisStyle} />
            <YAxis domain={[0, 100]} tick={axisStyle} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(13,27,33,.04)" }} />
            <Bar dataKey="mean" radius={[3, 3, 0, 0]} maxBarSize={84}>
              {byHelperMean.map((d, i) => <Cell key={i} fill={viabilityColor(d.mean)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="UMAP of the formulation space"
        sub="structure + formulation features · colored by viability">
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 12, right: 18, bottom: 12, left: 12 }}>
            <CartesianGrid stroke="#E3EAEA" strokeDasharray="2 5" />
            <XAxis type="number" dataKey="x" hide domain={["dataMin - 1", "dataMax + 1"]} />
            <YAxis type="number" dataKey="y" hide domain={["dataMin - 1", "dataMax + 1"]} />
            <ZAxis range={[18, 18]} />
            <Tooltip content={<UmapTooltip />} cursor={false} />
            <Scatter data={UMAP} shape={scatterDot("v")} isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
        <div className="umap-legend">
          <span className="legend-label">cytotoxic</span>
          <span className="legend-bar" />
          <span className="legend-label">viable</span>
        </div>
      </ChartCard>
    </section>
  );
}

/* ───────────────────────── submit view ───────────────────────── */
const SUBMIT_EMAIL = "nzl7@case.edu";

function SubmitView() {
  const pipeline = [
    ["Format", "Download the CSV template and enter one row per record — composition, cell line, cargo, and viability — matching the LNPCD schema."],
    ["Email", <>Send the CSV to <a href={`mailto:${SUBMIT_EMAIL}`}>{SUBMIT_EMAIL}</a> with your name, affiliation, and the source paper / DOI.</>],
    ["Validate", "We normalize units, canonicalize SMILES, and cross-check each record against its source figure or table."],
    ["Curate", "Approved records join LNPCD with attribution and appear in the database, charts, and UMAP."],
  ];
  return (
    <section className="submit">
      <div className="submit-intro">
        <h2>Contribute viability data</h2>
        <p>LNPCD grows by deposit. Email your records as a CSV that matches the schema and
          we’ll review and curate them in with attribution to your paper.</p>
      </div>

      <div className="steps">
        {pipeline.map(([t, d], i) => (
          <div className="step" key={t}>
            <span className="step-n mono">{String(i + 1).padStart(2, "0")}</span>
            <b>{t}</b><p>{d}</p>
          </div>
        ))}
      </div>

      <div className="submit-cta">
        <div className="submit-cta-copy">
          <span className="cite-label">How to submit</span>
          <p>Email your dataset CSV to <a href={`mailto:${SUBMIT_EMAIL}`}><b>{SUBMIT_EMAIL}</b></a>.
            Include your name, affiliation, and the source paper or DOI in the message. Need the
            format? Grab the template — it’s the schema header, ready to fill.</p>
        </div>
        <div className="submit-cta-actions">
          <a className="btn btn-solid" href={`mailto:${SUBMIT_EMAIL}?subject=${encodeURIComponent("LNPCD data submission")}`}>
            <Upload size={15} /> Email {SUBMIT_EMAIL}
          </a>
          <button className="btn btn-ghost" onClick={downloadTemplate}>
            <Download size={15} /> Download template
          </button>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── docs view ───────────────────────── */
function DocsView() {
  return (
    <section className="docs">
      <div className="docs-main">
        <h2>Schema</h2>
        <p className="lede">Every record reconciles one viability readout to its full formulation and assay context.</p>
        <table className="schema">
          <thead><tr><th>Field</th><th>Type</th><th>Description</th><th></th></tr></thead>
          <tbody>
            {SCHEMA.map((s) => (
              <tr key={s[0]}>
                <td className="mono strong">{s[0]}</td>
                <td className="mono dim">{s[1]}</td>
                <td>{s[2]}</td>
                <td><Pill tone={s[3] === "req" ? "req" : "opt"}>{s[3] === "req" ? "required" : "optional"}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Methodology</h2>
        <p>Records are extracted from peer-reviewed literature into structured rows, units
          normalized (µg/mL, hours, % of untreated control), lipid names mapped to a controlled
          vocabulary, and SMILES canonicalized. Each entry is cross-checked against its source
          figure or table before curation.</p>
      </div>
      <aside className="docs-side">
        <div className="cite">
          <span className="cite-label">Cite</span>
          <p className="mono">LNPCD: a standardized database of lipid nanoparticle cytotoxicity for nucleic acid delivery. <i>Draft, 2026.</i></p>
        </div>
        <div className="cite">
          <span className="cite-label">License</span>
          <p>CC BY 4.0 — academic and commercial use with attribution.</p>
        </div>
        <div className="cite">
          <span className="cite-label">Export</span>
          <button className="btn btn-solid sm full" onClick={downloadDataset}><Download size={13} /> Full CSV</button>
        </div>
      </aside>
    </section>
  );
}

/* ───────────────────────── app ───────────────────────── */
export default function App() {
  const [view, setView] = useState("home");
  return (
    <div className="lnpcd">
      <style>{CSS}</style>
      <Nav view={view} setView={setView} />
      <main>
        {view === "home" && <><Hero setView={setView} /><div className="view-pad"><OverviewView /></div></>}
        {view === "database" && <DatabaseView />}
        {view === "submit" && <div className="view-pad"><SubmitView /></div>}
        {view === "docs" && <div className="view-pad"><DocsView /></div>}
      </main>
      <footer className="foot">
        <span className="mono">LNPCD · © 2026 Nathan Liu. All Rights Reserved.</span>
      </footer>
    </div>
  );
}

/* ───────────────────────── styles ───────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Hanken+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

.lnpcd{
  --bench:#E7EDED; --panel:#FBFDFD; --ink:#0D1B21; --slate:#5C6E74;
  --line:#CBD7D7; --line2:#D7E0E0; --teal:#0E8C82; --teal-d:#0B6F67;
  --amber:#E0A12E; --rose:#D14B6A;
  background:var(--bench); color:var(--ink);
  font-family:'Hanken Grotesk',system-ui,sans-serif; min-height:100vh;
  -webkit-font-smoothing:antialiased;
}
.lnpcd *{box-sizing:border-box;}
.lnpcd h1,.lnpcd h2,.lnpcd h3,.lnpcd h4{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;letter-spacing:-.02em;margin:0;}
.lnpcd button{font-family:inherit;cursor:pointer;}
.mono{font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;}
.dim{color:var(--slate);}
.strong{font-weight:600;}
.lnpcd :focus-visible{outline:2px solid var(--teal);outline-offset:2px;}

/* nav */
.nav{position:sticky;top:0;z-index:30;display:flex;align-items:center;gap:18px;
  padding:13px 26px;background:rgba(231,237,237,.86);backdrop-filter:blur(10px);
  border-bottom:1px solid var(--line);}
.brand{display:flex;align-items:baseline;gap:9px;cursor:pointer;}
.brand-glyph{display:grid;place-items:center;width:30px;height:30px;background:var(--ink);
  color:#EAFBF8;border-radius:7px;align-self:center;}
.brand-word{font-family:'Bricolage Grotesque';font-weight:800;font-size:21px;letter-spacing:-.03em;}
.brand-sub{font-size:11.5px;color:var(--slate);letter-spacing:.01em;}
.nav-links{display:flex;gap:3px;margin-left:auto;}
.nav-link{display:flex;align-items:center;gap:6px;padding:8px 13px;border:none;background:none;
  color:var(--slate);font-size:13.5px;font-weight:500;border-radius:7px;transition:.15s;}
.nav-link:hover{color:var(--ink);background:#fff;}
.nav-link.is-active{color:var(--ink);background:var(--panel);box-shadow:inset 0 0 0 1px var(--line);}

.pill{font-family:'IBM Plex Mono';font-size:10px;text-transform:uppercase;letter-spacing:.1em;
  padding:4px 8px;border-radius:20px;white-space:nowrap;}
.pill-req{background:rgba(14,140,130,.12);color:var(--teal-d);}
.pill-opt{background:#EEF2F2;color:var(--slate);}

/* hero */
.hero{display:grid;grid-template-columns:1.05fr .95fr;gap:44px;align-items:center;
  padding:54px 40px 22px;max-width:1240px;margin:0 auto;}
.eyebrow{font-family:'IBM Plex Mono';font-size:11px;text-transform:uppercase;letter-spacing:.16em;
  color:var(--teal-d);}
.hero-copy h1{font-size:clamp(34px,4.4vw,52px);line-height:1.02;margin:16px 0 18px;}
.hero-copy p{font-size:16px;line-height:1.55;color:var(--slate);max-width:46ch;}
.hero-actions{display:flex;gap:11px;margin:26px 0 22px;flex-wrap:wrap;}
.btn{display:inline-flex;align-items:center;gap:7px;font-size:13.5px;font-weight:600;
  padding:11px 17px;border-radius:8px;border:1px solid transparent;transition:.15s;}
.btn-solid{background:var(--ink);color:#EAFBF8;}
.btn-solid:hover{background:#16323b;}
.btn-ghost{background:transparent;color:var(--ink);border-color:var(--line);}
.btn-ghost:hover{background:#fff;border-color:var(--slate);}
.btn.sm{padding:8px 12px;font-size:12.5px;}
.btn.full{width:100%;justify-content:center;}
.legend{display:flex;align-items:center;gap:10px;margin-top:6px;}
.legend-label{font-family:'IBM Plex Mono';font-size:10.5px;text-transform:uppercase;letter-spacing:.12em;color:var(--slate);}
.legend-bar{height:7px;width:150px;border-radius:4px;
  background:linear-gradient(90deg,#D14B6A,#E0A12E,#0FA597);}
.legend-ends{display:flex;justify-content:space-between;position:relative;width:150px;}
.legend-ends i{font-size:10px;color:var(--slate);font-style:normal;position:absolute;top:10px;}
.legend-ends i:first-child{left:0;}
.legend-ends i:last-child{right:0;}

/* plate */
.hero-plate{display:flex;justify-content:center;}
.plate{background:var(--panel);border:1px solid var(--line);border-radius:14px;
  padding:22px 26px 26px;box-shadow:0 24px 50px -28px rgba(13,27,33,.4);}
.plate-colnums,.plate-row{display:grid;grid-template-columns:20px repeat(12,1fr);gap:8px;align-items:center;}
.plate-colnums span,.plate-rowlabel{font-family:'IBM Plex Mono';font-size:9.5px;color:var(--slate);text-align:center;}
.plate-colnums{margin-bottom:8px;}
.plate-row{margin-bottom:8px;}
.well{aspect-ratio:1;border-radius:50%;background:var(--wc);
  box-shadow:inset 0 0 0 1px rgba(13,27,33,.06),inset 0 -2px 3px rgba(13,27,33,.12);
  transform:scale(0);animation:wellpop .4s cubic-bezier(.2,.9,.3,1.3) forwards;}
@keyframes wellpop{to{transform:scale(1);}}

.stat-strip{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:34px;}
.stat{position:relative;overflow:hidden;background:var(--panel);border:1px solid var(--line);border-radius:14px;
  padding:22px 20px 20px 24px;display:flex;flex-direction:column;gap:7px;
  box-shadow:0 1px 2px rgba(13,27,33,.04);
  transition:transform .2s cubic-bezier(.2,.8,.2,1),box-shadow .2s,border-color .2s;
  animation:statin .55s cubic-bezier(.2,.8,.2,1) both;}
.stat::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;
  background:linear-gradient(var(--teal),var(--teal-d));}
.stat::after{content:"";position:absolute;right:-30px;top:-30px;width:90px;height:90px;border-radius:50%;
  background:radial-gradient(circle,rgba(14,140,130,.10),transparent 70%);pointer-events:none;}
.stat:hover{transform:translateY(-4px);border-color:var(--teal);box-shadow:0 18px 34px -20px rgba(13,27,33,.45);}
.stat b{font-family:'Bricolage Grotesque';font-size:42px;font-weight:800;line-height:1;letter-spacing:-.025em;
  background:linear-gradient(135deg,var(--ink) 25%,var(--teal-d));
  -webkit-background-clip:text;background-clip:text;color:transparent;}
.stat span{font-size:11px;color:var(--slate);font-family:'IBM Plex Mono';text-transform:uppercase;letter-spacing:.11em;}
@keyframes statin{from{opacity:0;transform:translateY(12px);}}

/* view scaffolding */
.view-pad{max-width:1240px;margin:0 auto;padding:34px 40px 10px;}
.view-title{font-size:26px;margin-bottom:20px;}

/* controls */
.panel-wrap{max-width:1240px;margin:0 auto;padding:8px 40px 30px;}
.controls{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:14px 16px;
  background:var(--panel);border:1px solid var(--line);border-radius:11px;margin-bottom:14px;}
.search{display:flex;align-items:center;gap:8px;flex:1;min-width:220px;color:var(--slate);}
.search input{flex:1;border:none;background:none;font-family:inherit;font-size:14px;color:var(--ink);}
.search input:focus{outline:none;}
.ctrl{display:flex;flex-direction:column;gap:4px;}
.ctrl>span{font-size:10.5px;font-family:'IBM Plex Mono';text-transform:uppercase;letter-spacing:.08em;color:var(--slate);}
.ctrl select{border:1px solid var(--line);background:#fff;border-radius:7px;padding:6px 9px;font-family:inherit;font-size:13px;color:var(--ink);}
.ctrl-range{min-width:160px;}
.ctrl-range input{accent-color:var(--teal);}
.count{font-family:'IBM Plex Mono';font-size:12px;color:var(--slate);margin-left:auto;}

/* table */
.table-scroll{background:var(--panel);border:1px solid var(--line);border-radius:11px;overflow:hidden;overflow-x:auto;}
table.data{width:100%;border-collapse:collapse;font-size:13.5px;}
table.data thead th{text-align:left;font-family:'IBM Plex Mono';font-size:10.5px;text-transform:uppercase;
  letter-spacing:.07em;color:var(--slate);font-weight:500;padding:13px 14px;border-bottom:1px solid var(--line);background:#F4F8F8;}
table.data th.num,table.data td.num{text-align:right;}
table.data tbody tr{border-bottom:1px solid var(--line2);transition:background .12s;cursor:pointer;}
table.data tbody tr:last-child{border-bottom:none;}
table.data tbody tr:hover{background:#F1F6F6;}
table.data td{padding:12px 14px;vertical-align:middle;}
.tag{font-family:'IBM Plex Mono';font-size:11px;padding:3px 7px;border-radius:5px;background:#EEF2F2;color:var(--slate);}
.vcell{display:inline-flex;align-items:center;gap:8px;}
.vdot{width:11px;height:11px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(13,27,33,.12);}
.vnum{font-family:'IBM Plex Mono';font-size:13px;font-weight:500;}
.chev{color:var(--line);width:30px;}
table.data tr:hover .chev{color:var(--teal);}

/* drawer */
.drawer-scrim{position:fixed;inset:0;background:rgba(13,27,33,.34);z-index:40;display:flex;justify-content:flex-end;
  animation:fade .2s;}
@keyframes fade{from{opacity:0;}}
.drawer{width:min(440px,92vw);height:100%;overflow-y:auto;background:var(--bench);
  border-left:1px solid var(--line);padding:24px 26px 40px;animation:slide .26s cubic-bezier(.2,.8,.2,1);}
@keyframes slide{from{transform:translateX(28px);opacity:.4;}}
.drawer-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;}
.drawer-head h3{font-size:22px;margin-top:4px;}
.icon-btn{border:1px solid var(--line);background:#fff;border-radius:8px;width:34px;height:34px;display:grid;place-items:center;color:var(--ink);}
.icon-btn:hover{border-color:var(--slate);}
.readout{display:flex;gap:18px;align-items:center;margin:22px 0;padding:18px;background:var(--panel);border:1px solid var(--line);border-radius:12px;}
.readout-ring{width:90px;height:90px;border-radius:50%;display:grid;place-content:center;text-align:center;flex-shrink:0;
  background:conic-gradient(var(--c) calc(var(--p,70)*1%),#E7EDED 0);position:relative;}
.readout-ring::after{content:"";position:absolute;inset:9px;background:var(--panel);border-radius:50%;}
.readout-ring b,.readout-ring span{position:relative;z-index:1;}
.readout-ring b{font-family:'Bricolage Grotesque';font-size:23px;}
.readout-ring span{font-size:10px;color:var(--slate);font-family:'IBM Plex Mono';text-transform:uppercase;letter-spacing:.08em;}
.readout-meta{display:grid;grid-template-columns:1fr 1fr;gap:10px 16px;flex:1;}
.field{display:flex;flex-direction:column;gap:2px;}
.field span{font-size:10.5px;font-family:'IBM Plex Mono';text-transform:uppercase;letter-spacing:.07em;color:var(--slate);}
.field b{font-size:13.5px;font-weight:600;}
.drawer h4{font-size:12px;text-transform:uppercase;letter-spacing:.09em;color:var(--slate);margin:24px 0 10px;font-family:'IBM Plex Mono';font-weight:500;}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:13px 16px;}
.smiles{font-family:'IBM Plex Mono';font-size:11.5px;line-height:1.5;background:#fff;border:1px solid var(--line);
  border-radius:8px;padding:11px 12px;word-break:break-all;color:var(--ink);}
.struct-svg{background:#fff;border:1px solid var(--line);border-radius:10px;overflow:hidden;margin-bottom:12px;
  min-height:120px;display:flex;align-items:center;justify-content:center;padding:6px;}
.struct-svg svg{display:block;width:100%;height:auto;max-width:380px;}
.struct-fail{font-size:11.5px;color:var(--slate);padding:16px;text-align:center;}
.prov{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;}

/* overview (home charts) */
.overview{max-width:1240px;margin:0 auto;display:grid;grid-template-columns:repeat(6,1fr);gap:16px;}
.chart-card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px 16px 10px;grid-column:span 3;}
.overview .chart-card:nth-child(1),
.overview .chart-card:nth-child(2),
.overview .chart-card:nth-child(3){grid-column:span 2;}
.chart-head{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:6px;}
.chart-head h4{font-size:15px;}
.chart-head span{font-size:11px;color:var(--slate);font-family:'IBM Plex Mono';text-align:right;}

.umap-legend{display:flex;align-items:center;justify-content:center;gap:10px;margin:2px 0 8px;}
.umap-legend .legend-label{font-family:'IBM Plex Mono';font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--slate);}
.umap-legend .legend-bar{height:7px;width:180px;border-radius:4px;
  background:linear-gradient(90deg,#D14B6A,#E0A12E,#0FA597);}
.umap-tip{background:var(--panel);border:1px solid var(--ink);padding:8px 10px;display:flex;flex-direction:column;gap:2px;
  font-family:'IBM Plex Mono';font-size:11px;line-height:1.4;}
.umap-tip b{font-family:'Bricolage Grotesque';font-size:13px;}

/* database head */
.db-head{margin:2px 0 16px;}
.feat-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:14px;}
.feat{position:relative;overflow:hidden;background:var(--panel);border:1px solid var(--line);border-radius:14px;
  padding:18px 18px 17px 20px;display:flex;flex-direction:column;gap:9px;
  box-shadow:0 1px 2px rgba(13,27,33,.04);
  transition:transform .2s cubic-bezier(.2,.8,.2,1),box-shadow .2s,border-color .2s;
  animation:statin .55s cubic-bezier(.2,.8,.2,1) both;}
.feat::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;
  background:linear-gradient(var(--teal),var(--teal-d));}
.feat-ico{display:grid;place-items:center;width:34px;height:34px;border-radius:9px;
  background:rgba(14,140,130,.11);color:var(--teal-d);}
.feat b{font-family:'Bricolage Grotesque';font-size:15.5px;font-weight:700;letter-spacing:-.01em;color:var(--ink);}
.feat p{font-size:12.5px;color:var(--slate);line-height:1.5;margin:0;}
.feat:hover{transform:translateY(-4px);border-color:var(--teal);box-shadow:0 18px 34px -20px rgba(13,27,33,.45);}

/* submit */
.submit{max-width:900px;margin:0 auto;}
.submit-intro h2{font-size:28px;margin-bottom:8px;}
.submit-intro p{color:var(--slate);font-size:15.5px;max-width:54ch;line-height:1.55;}
.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:28px 0;}
.step{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:18px;}
.step-n{font-size:13px;color:var(--teal-d);}
.step b{display:block;font-family:'Bricolage Grotesque';font-size:16px;margin:8px 0 6px;}
.step p{font-size:13px;color:var(--slate);line-height:1.5;}
.step p a{color:var(--teal-d);}

/* submit CTA */
.submit-cta{margin-top:8px;display:flex;justify-content:space-between;align-items:center;gap:24px;flex-wrap:wrap;
  background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:24px;}
.submit-cta-copy{flex:1;min-width:260px;}
.submit-cta-copy p{font-size:14px;color:var(--slate);line-height:1.6;margin-top:8px;max-width:52ch;}
.submit-cta-copy a{color:var(--teal-d);}
.submit-cta-actions{display:flex;flex-direction:column;gap:10px;}
.submit-cta-actions .btn{justify-content:center;}

/* docs */
.docs{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:1fr 300px;gap:40px;}
.docs-main h2{font-size:24px;margin:6px 0 10px;}
.docs-main h2:nth-of-type(2){margin-top:34px;}
.lede{font-size:15.5px;color:var(--slate);line-height:1.55;margin-bottom:18px;max-width:60ch;}
.docs-main p{color:var(--slate);line-height:1.6;font-size:14.5px;max-width:62ch;}
table.schema{width:100%;border-collapse:collapse;font-size:13px;background:var(--panel);border:1px solid var(--line);border-radius:11px;overflow:hidden;}
table.schema th{text-align:left;font-family:'IBM Plex Mono';font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;
  color:var(--slate);font-weight:500;padding:11px 13px;background:#F4F8F8;border-bottom:1px solid var(--line);}
table.schema td{padding:11px 13px;border-bottom:1px solid var(--line2);vertical-align:middle;}
table.schema tr:last-child td{border-bottom:none;}
.docs-side{display:flex;flex-direction:column;gap:14px;}
.cite{background:var(--panel);border:1px solid var(--line);border-radius:11px;padding:15px;}
.cite-label{font-family:'IBM Plex Mono';font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--teal-d);}
.cite p{font-size:12.5px;color:var(--slate);line-height:1.5;margin-top:7px;}
.cite .btn{margin-top:9px;}

/* footer */
.foot{max-width:1240px;margin:30px auto 0;padding:20px 40px 34px;display:flex;justify-content:space-between;
  border-top:1px solid var(--line);font-size:12px;color:var(--slate);}

@media (max-width:880px){
  .hero{grid-template-columns:1fr;padding:34px 22px 14px;}
  .hero-plate{order:-1;}
  .stat-strip{grid-template-columns:repeat(2,1fr);}
  .feat-strip{grid-template-columns:1fr;}
  .docs,.steps{grid-template-columns:1fr;}
  .submit-cta-actions{width:100%;}
  .overview{grid-template-columns:1fr;}
  .overview .chart-card,
  .overview .chart-card:nth-child(1),
  .overview .chart-card:nth-child(2),
  .overview .chart-card:nth-child(3){grid-column:1/-1;}
  .nav-link span{display:none;}
  .nav-links{margin-left:0;}
  .brand-sub{display:none;}
  .panel-wrap,.view-pad{padding-left:20px;padding-right:20px;}
  table.data{font-size:12.5px;}
}
@media (prefers-reduced-motion:reduce){
  .well{animation:none;transform:scale(1);}
  .drawer,.drawer-scrim{animation:none;}
  .stat{animation:none;}
}
`;