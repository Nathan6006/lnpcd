import pandas as pd

# Read the CSV
df = pd.read_csv("lnpcd.csv")

# Define bins and labels
bins = [-float("inf"), 0.8, 0.9, float("inf")]
labels = ["<0.8", "0.8-0.9", ">0.9"]

# Bin the viability values
df["viability_bin"] = pd.cut(
    df["viability"],
    bins=bins,
    labels=labels,
    right=False  # Makes bins: [0.8,0.9), [0.9,inf)
)

# Count rows in each bin
counts = df["viability_bin"].value_counts().reindex(labels, fill_value=0)

# Print results
print("Viability bin counts:")
for label, count in counts.items():
    print(f"{label}: {count}")