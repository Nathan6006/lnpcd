# 🧬 Lipid Nanoparticle Cytotoxicity Database (LNPCD)

## 📄 Dataset Overview
LNPCD is a standardized, machine-learning-ready dataset of lipid nanoparticle (LNP)
formulations paired with their reported cytotoxicity outcomes, aggregated and harmonized
across the nucleic-acid delivery literature. Each record describes a complete LNP sample —
the ionizable lipid (as a canonical SMILES plus precomputed molecular descriptors), the
four-component molar composition, the experimental context (cell line, cargo, dosing), and
the measured viability — with delivery/transfection readouts included where the source
reported them. It is built as the cytotoxicity companion to the DUET-LNP project.

## 🎯 Dataset Content & Composition
The dataset contains **1,413 LNP samples** spanning **1,288 unique ionizable lipids**,
curated from **11 peer-reviewed studies**. Samples cover 4 cell lines, 2 cargo types
(mRNA, siRNA), and 3 helper-lipid identities (DOPE, DSPC, MDOA).

Cell-line coverage: IGROV1 (741), HeLa (314), HepG2 (283), MDA-MB (75).

## 📁 Data Structure and File Format
A single UTF-8 CSV file, `lnpcd.csv`, with **1,413 rows × 35 columns** — one row per LNP
sample. Columns fall into six groups:

**Identifiers & provenance** — `Lipid_name`, `smiles`, `Formulation`, `Experiment_ID`,
`Comment`, `paper_link`

**Formulation** — `Ionizable_Lipid_Mol_Ratio`, `Phospholipid_Mol_Ratio`,
`Cholesterol_Mol_Ratio`, `PEG_Lipid_Mol_Ratio`, `Helper_lipid_ID`,
`Ionizable_Lipid_to_mRNA_weight_ratio`

**Ionizable-lipid descriptors** — `Num_tails`, `Num_carbon_in_tail`, `MolWt` (log-scaled),
`num_unsaturated_cc_bonds`, `num_protonatable_nitrogens`

**Experimental context** — `Cargo_type`, `Model_type` (cell line), `Lipid/Cells`,
`NA/Cells` (log-scaled per-cell dose features)

**Readouts / targets** — `viability` (normalized, 0–1), `unnormalized_toxicity`
(raw viability, ~0–121%)

**One-hot encodings** — `Helper_lipid_ID_{DOPE,DSPC,MDOA}`, `Cargo_type_{mRNA,siRNA}`,
`Model_type_{HeLa,HepG2,IGROV1,MDA_MB}`

## 💻 Curation Details
* **Aggregation:** samples drawn from 11 source publications and harmonized into one schema.
* **Standardization:** four-component molar ratios written in fixed order; helper-lipid,
  cargo, and cell-line identities mapped to controlled vocabularies and one-hot encoded.
* **Structure encoding:** ionizable-lipid SMILES with precomputed descriptors (tail count,
  carbons per tail, log molecular weight, C=C unsaturation, protonatable nitrogens).
* **Targets:** cytotoxicity is provided in two aligned forms — continuous normalized
  (`viability`), continuous raw (`unnormalized_toxicity`)

## ⚠️ Important Note on Comparability
Samples come from different laboratories, assays, and dosing conventions, so the readouts
are **not perfectly comparable across source studies**. Values are as reported by the original studies and are not a calibrated reference standard.

## ⚖️ License
This dataset is licensed under the [Creative Commons Attribution 4.0 International
(CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/) license. 

**Interactive database:** https://lnpcd.pages.dev  ·  **Code:** https://github.com/Nathan6006/lnpcd

## 📧 Contact
For questions regarding the dataset or the associated study, please contact:

Nathan Liu — Email: nzl7@case.edu