import { Boxes, Factory, Scissors, Activity } from "lucide-react";

export default function ModuleSelectionPage({ onSelect }) {
  return (
    <section className="module-selection">
      <div className="module-selection-heading">
        <span>UG SAAS</span>
        <h1>Select Your Workspace</h1>
        <p>Open the Store or Elastic Production management module.</p>
      </div>

      <div className="module-selection-grid">
        <button
          className="module-card fabric-module"
          onClick={() => onSelect("Fabric Master")}
        >
          <i>
            <Boxes />
          </i>
          <div>
            <small>MATERIAL</small>
            <h2>Fabric</h2>
            <p>Master, inward, colour, dia, roll and weight</p>
          </div>
          <b>Open Fabric</b>
        </button>

        <button
          className="module-card cutting-module"
          onClick={() => onSelect("Production Plan Data Entry")}
        >
          <i>
            <Scissors />
          </i>
          <div>
            <small>PRODUCTION</small>
            <h2>Cutting</h2>
            <p>Plan, issue, actual pieces, bundles and waste</p>
          </div>
          <b>Open Cutting</b>
        </button>
        <button
          className="module-card store-module"
          onClick={() => onSelect("Dashboard")}
        >
          <i>
            <Boxes />
          </i>
          <div>
            <small>INVENTORY</small>
            <h2>Store</h2>
            <p>PO, inward, stock, outward, DC and print management</p>
          </div>
          <b>Open Store</b>
        </button>

        <button
          className="module-card elastic-module"
          onClick={() => onSelect("Elastic Requirement")}
        >
          <i>
            <Activity />
          </i>
          <div>
            <small>ACTUAL PCS</small>
            <h2>Elastic</h2>
            <p>Automatic size and colour-wise elastic requirement</p>
          </div>
          <b>Open Elastic</b>
        </button>

        <button
          className="module-card production-module"
          onClick={() => onSelect("Production Dashboard")}
        >
          <i>
            <Factory />
          </i>
          <div>
            <small>ELASTIC</small>
            <h2>Production</h2>
            <p>Planning, machines, operators, pending and sewing flow</p>
          </div>
          <b>Open Production</b>
        </button>
      </div>
    </section>
  );
}
