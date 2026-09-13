import { useState } from "react";
import { api } from "../api/http.js";
import { Field, PageTitle } from "../components/Common.jsx";

const initial = {
  outwardNo: "", planNo: "", itemCode: "", itemName: "", style: "", colour: "",
  sizes: "", plannedPieces: "", actualPieces: "", foldingWeights: "",
  issuedCuttingWeightKg: "", cutBundleWeightKg: "", returnedFabricWeightKg: 0,
  status: "COMPLETED", remarks: "",
};

export default function CuttingActualPage() {
  const [form, setForm] = useState(initial);
  const [result, setResult] = useState(null);

  async function save(event) {
    event.preventDefault();
    const sizes = form.sizes.split(",").map((value) => value.trim());
    const planned = form.plannedPieces.split(",").map(Number);
    const actual = form.actualPieces.split(",").map(Number);
    const folding = form.foldingWeights.split(",").map(Number);
    if (![planned, actual, folding].every((values) => values.length === sizes.length)) {
      throw new Error("Size, planned PCS, actual PCS and folding measurement counts must match");
    }
    const data = {
      ...form,
      outwardNo: Number(form.outwardNo),
      sizes: sizes.map((size, index) => ({
        size,
        plannedPieces: planned[index],
        actualPieces: actual[index],
        foldingWeightPerPieceKg: folding[index],
      })),
      issuedCuttingWeightKg: Number(form.issuedCuttingWeightKg),
      cutBundleWeightKg: Number(form.cutBundleWeightKg),
      returnedFabricWeightKg: Number(form.returnedFabricWeightKg),
    };
    setResult(await api("/cutting/actual", { method: "POST", body: JSON.stringify(data) }));
  }

  return <>
    <PageTitle title="Cutting Actual" text="Save actual PCS, bundle weight, return, waste and create folding demand." />
    <form className="card form" onSubmit={save}>
      <div className="grid">
        {Object.entries(form).map(([key, value]) => <Field key={key} label={key.replaceAll(/([A-Z])/g, " $1")}>
          <input
            required={!['remarks', 'returnedFabricWeightKg'].includes(key)}
            type={['outwardNo', 'issuedCuttingWeightKg', 'cutBundleWeightKg', 'returnedFabricWeightKg'].includes(key) ? "number" : "text"}
            step="0.001"
            value={value}
            onChange={(event) => setForm({ ...form, [key]: event.target.value })}
          />
        </Field>)}
      </div>
      <button>Complete Cutting</button>
    </form>
    {result && <section className="card result">
      <h3>Saved Successfully</h3>
      <p>Actual: <b>{result.actual.cuttingActualNo}</b></p>
      <p>Waste: <b>{result.actual.wasteWeightKg} KG ({result.actual.wastePercentage}%)</b></p>
      <p>Folding wanted: <b>{result.folding.wantedWeightKg} KG</b></p>
    </section>}
  </>;
}
