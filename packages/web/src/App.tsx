import { NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import ItemDetail from "./pages/ItemDetail";
import AddItem from "./pages/AddItem";

export default function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">Appliance Price Tracker</div>
        <nav>
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            Today
          </NavLink>
          <NavLink to="/add" className={({ isActive }) => (isActive ? "active" : "")}>
            Add Item
          </NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/items/:id" element={<ItemDetail />} />
          <Route path="/add" element={<AddItem />} />
        </Routes>
      </main>
    </div>
  );
}
