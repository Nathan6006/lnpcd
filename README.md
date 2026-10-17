# 🧬 Lipid Nanoparticle Cytotoxicity Database (LNPCD)

## 📄 Dataset Overview
LNPCD is a standardized, machine-learning-ready dataset of lipid nanoparticle (LNP)
formulations paired with their reported cytotoxicity outcomes, aggregated and harmonized
across the nucleic-acid delivery literature. Each record describes a complete LNP sample —
the ionizable lipid (as a canonical SMILES plus precomputed molecular descriptors), the
four-component molar composition, the experimental context (cell line, cargo, dosing), and
the measured viability. It is built as the cytotoxicity companion to the DUET-LNP project.

## 🎯 Dataset Content & Composition
The dataset contains **1,413 LNP samples** spanning **1,288 unique ionizable lipids**,
curated from **11 peer-reviewed studies**. Samples cover 4 cell lines, 2 cargo types
(mRNA, siRNA), and 3 helper-lipid identities (DOPE, DSPC, MDOA).

Cell-line coverage: IGROV1 (741), HeLa (314), HepG2 (283), MDA-MB (75).

## 📁 Data Structure and File Format
A single UTF-8 CSV file, `lnpcd.csv`, with **1,413 rows × 31 columns** — one row per LNP
sample. Columns fall into five groups:

**Identifiers & provenance** — `Lipid_name`, `smiles`, `Experiment_ID`, `paper_link`

**Formulation** — `Ionizable_Lipid_Mol_Ratio`, `Helper_Lipid_Mol_Ratio`,
`Cholesterol_Mol_Ratio`, `PEG_Lipid_Mol_Ratio`, `Helper_lipid_ID`,
`Ionizable_Lipid_to_mRNA_weight_ratio`

**Ionizable-lipid descriptors** — `Num_tails`, `Num_carbon_in_tail` (carbons in the
longest unbroken run of non-ring carbons), `MolWt` (average molecular weight in g/mol),
`num_unsaturated_cc_bonds` (C=C and C#C bonds anywhere in the molecule), `num_protonatable_nitrogens`,
`Topological_Polar_Surface_Area` (Å²), `Hydrogen_Bond_Donors`, `LogP` (Crippen),
`Fraction_sp3_Carbons`, `Nitrogen_Count`, `Rings`, `Aromatic_Rings`, `has_ester` (0/1).
All are computed from the ionizable-lipid SMILES with RDKit. The descriptor set was
pruned so that no retained pair exceeds |r| = 0.89 — size-type descriptors (heavy-atom
count, molar refractivity, rotatable bonds, sp3 carbon count, van der Waals volume) were
dropped as redundant with `MolWt`, and H-bond acceptor count as redundant with TPSA.

**Experimental context** — `Cargo_type`, `Model_type` (cell line), `Lipid/Cells`,
`NA/Cells` (ng per 1,000 cells), `Lipid_concentration`, `NA_concentration` (µg/mL in well)

**Readouts / targets** — `viability` (normalized, 0–1), `viability_raw_percent`
(raw viability in percent, 0–121)

All numeric features are given in natural units; categorical fields (`Helper_lipid_ID`,
`Cargo_type`, `Model_type`) are left as labels rather than one-hot encoded.

## 💻 Curation Details
* **Aggregation:** samples drawn from 11 source publications and harmonized into one schema.
* **Standardization:** four-component molar ratios written in fixed order; helper-lipid,
  cargo, and cell-line identities mapped to controlled vocabularies. `Helper_lipid_ID` is
  blank for the 69 `Miller_zwitter` records, whose formulations carry no helper phospholipid.
* **Structure encoding:** ionizable-lipid SMILES with precomputed descriptors (tail count,
  longest non-ring carbon run, molecular weight, C=C/C#C unsaturation, protonatable nitrogens).
* **Targets:** cytotoxicity is provided in two aligned forms — continuous normalized
  (`viability`), continuous raw (`viability_raw_percent`)

## ⚠️ Important Note on Comparability
Samples come from different laboratories, assays, and dosing conventions, so the readouts
are **not perfectly comparable across source studies**. Values are as reported by the original studies and are not a calibrated reference standard.

## ⚖️ License
Code and data are licensed separately:

* **`lnpcd.csv` (the dataset)** — [Creative Commons Attribution 4.0 International
  (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/), full text in
  [`LICENSE-DATA`](LICENSE-DATA). Free to use, including commercially, with attribution.
* **The web app source in this repository** — [MIT](LICENSE).

## 🔗 Related
This repository holds the LNPCD **web app** (React + Vite) together with the published
dataset file it serves. The code that reconstructs the ionizable-lipid structures and
writes their canonical SMILES lives in a separate repository.

* **Interactive database:** https://lnpcd.pages.dev
* **Structure-generation code:** https://github.com/Nathan6006/LNPCD-SMILES
* **Dataset archive (DOI):** https://doi.org/10.5281/zenodo.21071179

## 📧 Contact
For questions regarding the dataset or the associated study, please contact:

Nathan Liu — Email: nzl7@case.edu