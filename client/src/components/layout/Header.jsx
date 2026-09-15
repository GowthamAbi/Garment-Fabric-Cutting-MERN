import { Menu } from "lucide-react";
export default function Header({ page, onMenu }) {
  return (
    <header className="topbar">
      <button className="menu" onClick={onMenu}>
        <Menu />
      </button>
      <div>
        <small>Yarn & Accessories</small>
        <h1>{page}</h1>
      </div>
    </header>
  );
}
