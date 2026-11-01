import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Html5QrcodeScanner } from "html5-qrcode";
import {
  getFlats, createFlat, deleteFlat, generateFlatQR,
  getResidents, createResident, deleteResident,
  getVisitors, createVisitor, checkoutVisitor, deleteVisitor,
  getSecondaryPeople, createSecondaryPerson, deleteSecondaryPerson,
  validateQR, getCurrentResidentStatus, recordResidentMovement,
  getCurrentProviderStatus, recordProviderMovement,
  type Flat, type Resident, type Visitor, type SecondaryPerson,
  type MovementAction, type FlatQRCreated,
} from "./api";
import {
  LayoutDashboard, Users, UserRoundCog, ClipboardList,
  ShieldCheck, Settings, Search, Plus, Trash2, Menu, X,
  Clock, Car, QrCode, ArrowDownRight, ArrowUpRight,
} from "lucide-react";

type Page =
  | "Dashboard"
  | "Flats"
  | "Residents"
  | "Service Providers"
  | "Visitors"
  | "Access Logs";

const navigation = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Flats", icon: LayoutDashboard },
  { label: "Residents", icon: Users },
  { label: "Service Providers", icon: UserRoundCog },
  { label: "Visitors", icon: ClipboardList },
  { label: "Access Logs", icon: ShieldCheck },
] as const;

export default function App() {
  const [page, setPage] = useState<Page>("Dashboard");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  const [flats, setFlats] = useState<Flat[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [providers, setProviders] = useState<SecondaryPerson[]>([]);
  const [residentStatuses, setResidentStatuses] = useState<any[]>([]);
  const [providerStatuses, setProviderStatuses] = useState<any[]>([]);

  const [flatNumber, setFlatNumber] = useState("");
  const [building, setBuilding] = useState("");

  const [residentName, setResidentName] = useState("");
  const [residentFlat, setResidentFlat] = useState("");
  const [residentPhone, setResidentPhone] = useState("");

  const [providerName, setProviderName] = useState("");
  const [providerPhone, setProviderPhone] = useState("");
  const [providerCategory, setProviderCategory] = useState("Maid");
  const [providerResident, setProviderResident] = useState("");

  const [visitorName, setVisitorName] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [visitorFlat, setVisitorFlat] = useState("");
  const [visitorPurpose, setVisitorPurpose] = useState("Personal Visit");
  const [visitorVehicle, setVisitorVehicle] = useState("");

  const [qrToken, setQrToken] = useState("");
  const [flatQr, setFlatQr] = useState<FlatQRCreated | null>(null);
  const [scanEnabled, setScanEnabled] = useState(false);
  const [scanResult, setScanResult] = useState("");

  const loadAll = useCallback(async () => {
    try {
      const [
        flatData,
        residentData,
        visitorData,
        providerData,
        residentStatusData,
        providerStatusData,
      ] = await Promise.all([
        getFlats(),
        getResidents(),
        getVisitors(),
        getSecondaryPeople(),
        getCurrentResidentStatus(),
        getCurrentProviderStatus(),
      ]);

      setFlats(flatData);
      setResidents(residentData);
      setVisitors(visitorData);
      setProviders(providerData);
      setResidentStatuses(residentStatusData);
      setProviderStatuses(providerStatusData);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load data.");
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!scanEnabled) return;

    const scanner = new Html5QrcodeScanner(
      "gatepass-scanner",
      { fps: 10, qrbox: { width: 230, height: 230 } },
      false
    );

    scanner.render(
      async (decodedText) => {
        try {
          const result = await validateQR(decodedText);
          if (result.type === "flat" && result.flat) {
            setScanResult(
              `Verified flat: ${result.flat.building ?? ""} ${result.flat.flat_number}`
            );
          } else if (result.person) {
            setScanResult(
              `Verified: ${result.person.full_name} · ${result.person.category} · ${result.person.flat_number ?? ""}`
            );
          } else {
            setScanResult("QR verified.");
          }
          await scanner.clear();
          setScanEnabled(false);
        } catch (error) {
          setScanResult(error instanceof Error ? error.message : "QR verification failed.");
          await scanner.clear().catch(() => undefined);
          setScanEnabled(false);
        }
      },
      () => {}
    );

    return () => {
      void scanner.clear().catch(() => undefined);
    };
  }, [scanEnabled]);

  function confirmDelete(label: string) {
    return window.confirm(
      `Permanently delete ${label}? This cannot be undone.`
    );
  }

  async function handleDelete(
    label: string,
    action: () => Promise<void>
  ) {
    if (!confirmDelete(label)) return;
    try {
      await action();
      await loadAll();
      setMessage(`${label} permanently deleted.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delete failed.");
    }
  }

  async function handleFlatSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      await createFlat({
        flat_number: flatNumber.trim(),
        building: building.trim() || null,
      });
      setFlatNumber("");
      setBuilding("");
      setMessage("Flat registered.");
      await loadAll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not register flat.");
    }
  }

  async function handleResidentSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!/^[0-9]{10}$/.test(residentPhone)) {
      setMessage("Resident phone number must contain exactly 10 digits.");
      return;
    }

    try {
      await createResident({
        full_name: residentName.trim(),
        flat_id: Number(residentFlat),
        phone: residentPhone,
      });
      setResidentName("");
      setResidentFlat("");
      setResidentPhone("");
      setMessage("Resident registered.");
      await loadAll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not register resident.");
    }
  }

  async function handleProviderSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!/^[0-9]{10}$/.test(providerPhone)) {
      setMessage("Service provider phone number must contain exactly 10 digits.");
      return;
    }

    const resident = residents.find(
      (item) => item.id === Number(providerResident)
    );

    if (!resident) {
      setMessage("Select a valid primary resident.");
      return;
    }

    try {
      const created = await createSecondaryPerson({
        full_name: providerName.trim(),
        phone: providerPhone,
        category: providerCategory,
        resident_id: resident.id,
        flat_id: resident.flat_id,
      });

      setQrToken(created.qr_token);
      setProviderName("");
      setProviderPhone("");
      setProviderResident("");
      setMessage("Service provider registered. Save their QR code.");
      await loadAll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not register provider.");
    }
  }

  async function handleVisitorSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!/^[0-9]{10}$/.test(visitorPhone)) {
      setMessage("Visitor phone number must contain exactly 10 digits.");
      return;
    }

    try {
      await createVisitor({
        full_name: visitorName.trim(),
        flat_id: Number(visitorFlat),
        phone: visitorPhone,
        purpose: visitorPurpose,
        vehicle_number: visitorVehicle.trim() || null,
      });

      setVisitorName("");
      setVisitorPhone("");
      setVisitorFlat("");
      setVisitorVehicle("");
      setVisitorPurpose("Personal Visit");
      setMessage("Visitor checked in successfully.");
      await loadAll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not register visitor.");
    }
  }

  async function movement(
    kind: "resident" | "provider",
    id: number,
    action: MovementAction
  ) {
    const vehicle = action === "Check In"
      ? window.prompt("Vehicle number (if applicable):") ?? ""
      : "";

    try {
      if (kind === "resident") {
        await recordResidentMovement(id, {
          action,
          vehicle_number: vehicle.trim() || null,
        });
      } else {
        await recordProviderMovement(id, {
          action,
          vehicle_number: vehicle.trim() || null,
        });
      }
      setMessage(`${action} recorded.`);
      await loadAll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Movement could not be recorded.");
    }
  }

  async function handleFlatQR(flat: Flat) {
    try {
      const result = await generateFlatQR(flat.id);
      setFlatQr(result);
      setMessage("New flat QR generated. Previous QR for this flat is replaced.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not generate flat QR.");
    }
  }

  const insideVisitors = visitors.filter((v) => v.status === "Inside");
  const today = new Date().toDateString();
  const todayVisitors = visitors.filter(
    (v) => new Date(v.created_at).toDateString() === today
  );

  const filteredVisitors = visitors.filter((v) =>
    [
      v.full_name,
      v.flat_number,
      v.building ?? "",
      v.phone,
      v.purpose,
      v.status,
    ].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  function residentStatus(id: number) {
    return residentStatuses.find((item) => item.resident_id === id)?.status ?? "Unknown";
  }

  function providerStatus(id: number) {
    return providerStatuses.find((item) => item.person_id === id)?.status ?? "Unknown";
  }

  function flatLabel(flat: Flat) {
    return `${flat.building ? `${flat.building} - ` : ""}${flat.flat_number}`;
  }

  function renderFlats() {
    return (
      <section className="panel" style={{ padding: 24 }}>
        <h3>Registered Flats</h3>
        <p>Manage flats and their QR codes.</p>

        <form onSubmit={handleFlatSubmit} className="management-form">
          <input
            value={flatNumber}
            onChange={(e) => setFlatNumber(e.target.value)}
            placeholder="Flat number (e.g. A-101)"
            required
            maxLength={30}
          />
          <input
            value={building}
            onChange={(e) => setBuilding(e.target.value)}
            placeholder="Building / tower"
            maxLength={60}
          />
          <button type="submit"><Plus size={16} /> Register Flat</button>
        </form>

        {flats.map((flat) => (
          <div className="management-row" key={flat.id}>
            <div>
              <strong>{flatLabel(flat)}</strong>
            </div>
            <div className="row-actions">
              <button type="button" onClick={() => void handleFlatQR(flat)}>
                <QrCode size={15} /> Generate QR
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={() => void handleDelete(
                  `flat ${flatLabel(flat)} and all its associated records`,
                  () => deleteFlat(flat.id)
                )}
              >
                <Trash2 size={15} /> Delete
              </button>
            </div>
          </div>
        ))}

        {flatQr && (
          <div className="qr-card">
            <h4>Flat QR: {flatLabel(flatQr.flat)}</h4>
            <QRCodeSVG value={flatQr.qr_token} size={180} />
            <p>Keep this QR code secure.</p>
          </div>
        )}
      </section>
    );
  }

  function renderResidents() {
    return (
      <section className="panel" style={{ padding: 24 }}>
        <h3>Resident Management</h3>
        <p>Register residents and track their entry and exit.</p>

        <form onSubmit={handleResidentSubmit} className="management-form">
          <input
            value={residentName}
            onChange={(e) => setResidentName(e.target.value)}
            placeholder="Resident full name"
            required
            maxLength={100}
          />
          <select
            value={residentFlat}
            onChange={(e) => setResidentFlat(e.target.value)}
            required
          >
            <option value="">Select flat</option>
            {flats.map((flat) => (
              <option key={flat.id} value={flat.id}>{flatLabel(flat)}</option>
            ))}
          </select>
          <input
            value={residentPhone}
            onChange={(e) => setResidentPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="10-digit phone number"
            type="tel"
            inputMode="numeric"
            pattern="[0-9]{10}"
            maxLength={10}
            required
          />
          <button type="submit" disabled={!flats.length}>
            <Plus size={16} /> Register Resident
          </button>
        </form>

        {residents.map((resident) => {
          const status = residentStatus(resident.id);
          return (
            <div className="management-row" key={resident.id}>
              <div>
                <strong>{resident.full_name}</strong>
                <div>{resident.flat_number} · {resident.phone}</div>
                <span className={`badge ${status === "Inside" ? "badge-green" : "badge-gray"}`}>
                  {status}
                </span>
              </div>
              <div className="row-actions">
                {status !== "Inside" ? (
                  <button type="button" onClick={() => void movement("resident", resident.id, "Check In")}>
                    <ArrowDownRight size={15} /> Check In
                  </button>
                ) : (
                  <button type="button" onClick={() => void movement("resident", resident.id, "Check Out")}>
                    <ArrowUpRight size={15} /> Check Out
                  </button>
                )}
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => void handleDelete(
                    `resident ${resident.full_name} and their linked providers and movement history`,
                    () => deleteResident(resident.id)
                  )}
                >
                  <Trash2 size={15} /> Delete
                </button>
              </div>
            </div>
          );
        })}
      </section>
    );
  }

  function renderProviders() {
    return (
      <section className="panel" style={{ padding: 24 }}>
        <h3>Service Provider Management</h3>
        <p>Register recurring service providers and track their movements.</p>

        <form onSubmit={handleProviderSubmit} className="management-form">
          <input
            value={providerName}
            onChange={(e) => setProviderName(e.target.value)}
            placeholder="Provider full name"
            required
            maxLength={100}
          />
          <input
            value={providerPhone}
            onChange={(e) => setProviderPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="10-digit phone number"
            type="tel"
            inputMode="numeric"
            pattern="[0-9]{10}"
            maxLength={10}
            required
          />
          <select
            value={providerCategory}
            onChange={(e) => setProviderCategory(e.target.value)}
          >
            <option>Maid</option>
            <option>Milk vendor</option>
            <option>Newspaper vendor</option>
            <option>Driver</option>
            <option>Delivery</option>
            <option>Electrician / plumber</option>
            <option>Other</option>
          </select>
          <select
            value={providerResident}
            onChange={(e) => setProviderResident(e.target.value)}
            required
          >
            <option value="">Link to primary resident</option>
            {residents.filter((r) => r.is_active).map((r) => (
              <option key={r.id} value={r.id}>
                {r.full_name} · {r.flat_number}
              </option>
            ))}
          </select>
          <button type="submit" disabled={!residents.some((r) => r.is_active)}>
            <Plus size={16} /> Register Provider
          </button>
        </form>

        {providers.map((person) => {
          const status = providerStatus(person.id);
          return (
            <div className="management-row" key={person.id}>
              <div>
                <strong>{person.full_name}</strong>
                <div>{person.category} · {person.flat_number} · {person.phone}</div>
                <div>Resident: {person.primary_resident ?? "Not linked"}</div>
                <span className={`badge ${status === "Inside" ? "badge-green" : "badge-gray"}`}>
                  {status}
                </span>
              </div>
              <div className="row-actions">
                {status !== "Inside" ? (
                  <button type="button" onClick={() => void movement("provider", person.id, "Check In")}>
                    <ArrowDownRight size={15} /> Check In
                  </button>
                ) : (
                  <button type="button" onClick={() => void movement("provider", person.id, "Check Out")}>
                    <ArrowUpRight size={15} /> Check Out
                  </button>
                )}
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => void handleDelete(
                    `service provider ${person.full_name}`,
                    () => deleteSecondaryPerson(person.id)
                  )}
                >
                  <Trash2 size={15} /> Delete
                </button>
              </div>
            </div>
          );
        })}

        {qrToken && (
          <div className="qr-card">
            <h4>New Service Provider QR</h4>
            <QRCodeSVG value={qrToken} size={180} />
            <p>Save or print this QR code. It will not be shown again after leaving this page.</p>
            <button type="button" onClick={() => setQrToken("")}>Close QR</button>
          </div>
        )}
      </section>
    );
  }

  function renderVisitors() {
    return (
      <section className="panel" style={{ padding: 24 }}>
        <h3>Visitor Registration</h3>
        <p>Register temporary visitors. Registration records their check-in time.</p>

        <form onSubmit={handleVisitorSubmit} className="management-form">
          <input
            value={visitorName}
            onChange={(e) => setVisitorName(e.target.value)}
            placeholder="Visitor full name"
            required
            maxLength={100}
          />
          <input
            value={visitorPhone}
            onChange={(e) => setVisitorPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="10-digit phone number"
            type="tel"
            inputMode="numeric"
            pattern="[0-9]{10}"
            maxLength={10}
            required
          />
          <select
            value={visitorFlat}
            onChange={(e) => setVisitorFlat(e.target.value)}
            required
          >
            <option value="">Select destination flat</option>
            {flats.map((flat) => (
              <option key={flat.id} value={flat.id}>{flatLabel(flat)}</option>
            ))}
          </select>
          <select
            value={visitorPurpose}
            onChange={(e) => setVisitorPurpose(e.target.value)}
          >
            <option>Personal Visit</option>
            <option>Delivery</option>
            <option>Maintenance</option>
            <option>Service Provider</option>
            <option>Other</option>
          </select>
          <input
            value={visitorVehicle}
            onChange={(e) => setVisitorVehicle(e.target.value)}
            placeholder="Vehicle number (if applicable)"
            maxLength={30}
          />
          <button type="submit" disabled={!flats.length}>
            <Plus size={16} /> Register Visitor
          </button>
        </form>

        <div className="table-toolbar">
          <div className="search-box">
            <Search size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search visitors..."
            />
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>VISITOR</th>
                <th>DESTINATION</th>
                <th>PURPOSE</th>
                <th>VEHICLE</th>
                <th>CHECK-IN</th>
                <th>CHECK-OUT</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filteredVisitors.map((visitor) => (
                <tr key={visitor.id}>
                  <td>{visitor.full_name}<br />{visitor.phone}</td>
                  <td>{visitor.building ? `${visitor.building} - ` : ""}{visitor.flat_number}</td>
                  <td>{visitor.purpose}</td>
                  <td>{visitor.vehicle_number || "—"}</td>
                  <td>{new Date(visitor.created_at).toLocaleString()}</td>
                  <td>{visitor.exited_at ? new Date(visitor.exited_at).toLocaleString() : "—"}</td>
                  <td>
                    {visitor.status === "Inside" && (
                      <button type="button" onClick={async () => {
                        try {
                          await checkoutVisitor(visitor.id);
                          await loadAll();
                          setMessage("Visitor checked out.");
                        } catch (error) {
                          setMessage(error instanceof Error ? error.message : "Checkout failed.");
                        }
                      }}>
                        Check Out
                      </button>
                    )}
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => void handleDelete(
                        `visitor ${visitor.full_name}`,
                        () => deleteVisitor(visitor.id)
                      )}
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filteredVisitors.length === 0 && (
                <tr><td colSpan={7}>No visitor records found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  function renderAccessLogs() {
    const residentEvents = residentStatuses;
    const providerEvents = providerStatuses;

    return (
      <section className="panel" style={{ padding: 24 }}>
        <h3>Access Logs</h3>
        <p>Current movement status for residents and service providers, plus visitor history.</p>

        <h4>Recent visitor activity</h4>
        <div className="table-scroll">
          <table>
            <thead>
              <tr><th>VISITOR</th><th>FLAT</th><th>STATUS</th><th>ARRIVAL</th><th>EXIT</th><th>VEHICLE</th></tr>
            </thead>
            <tbody>
              {visitors.map((v) => (
                <tr key={v.id}>
                  <td>{v.full_name}</td>
                  <td>{v.flat_number}</td>
                  <td>{v.status}</td>
                  <td>{new Date(v.created_at).toLocaleString()}</td>
                  <td>{v.exited_at ? new Date(v.exited_at).toLocaleString() : "—"}</td>
                  <td>{v.vehicle_number || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h4>Resident current status</h4>
        {residentEvents.map((r) => (
          <div className="management-row" key={r.resident_id}>
            <strong>{r.full_name}</strong>
            <span>{r.flat_number} · {r.status}</span>
            <span>{r.created_at ? new Date(r.created_at).toLocaleString() : "No movement yet"}</span>
          </div>
        ))}

        <h4>Service provider current status</h4>
        {providerEvents.map((p) => (
          <div className="management-row" key={p.person_id}>
            <strong>{p.full_name}</strong>
            <span>{p.category} · {p.flat_number} · {p.status}</span>
            <span>{p.created_at ? new Date(p.created_at).toLocaleString() : "No movement yet"}</span>
          </div>
        ))}
      </section>
    );
  }

  function renderDashboard() {
    return (
      <>
        <section className="stats-grid">
          {[
            ["Total Visitors", visitors.length],
            ["Currently Inside", insideVisitors.length],
            ["Today's Visitors", todayVisitors.length],
            ["Registered Flats", flats.length],
            ["Residents", residents.length],
            ["Service Providers", providers.length],
          ].map(([label, value]) => (
            <article className="stat-card" key={label}>
              <div className="stat-value">{value}</div>
              <div className="stat-label">{label}</div>
            </article>
          ))}
        </section>

        <div style={{ marginTop: 24 }}>{renderVisitors()}</div>
        <div style={{ marginTop: 24 }}>{renderFlats()}</div>
        <div style={{ marginTop: 24 }}>{renderResidents()}</div>
      </>
    );
  }

  return (
    <div className="app-shell">
      {mobileMenu && (
        <button
          className="mobile-overlay"
          aria-label="Close menu"
          onClick={() => setMobileMenu(false)}
        />
      )}

      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><ShieldCheck size={25} /></div>
          <div>
            <h1>GatePass</h1>
            <span>COMMUNITY MANAGEMENT</span>
          </div>
          <button className="icon-button mobile-close" onClick={() => setMobileMenu(false)}>
            <X size={20} />
          </button>
        </div>

        <div className="workspace-label">WORKSPACE</div>
        <nav className="navigation">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                className={`nav-item ${page === item.label ? "nav-active" : ""}`}
                onClick={() => {
                  setPage(item.label);
                  setMobileMenu(false);
                }}
              >
                <Icon size={19} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="security-card">
            <div className="security-icon"><ShieldCheck size={20} /></div>
            <strong>Security overview</strong>
            <p>Access monitoring dashboard</p>
            <div className="security-status">
              <span className="status-dot" /> Database connected via API
            </div>
          </div>
          <div className="profile">
            <div className="avatar admin-avatar">AD</div>
            <div className="profile-info">
              <strong>Society Admin</strong>
              <span>Administrator</span>
            </div>
            <Settings size={18} />
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu-button" onClick={() => setMobileMenu(true)}>
            <Menu size={22} />
          </button>
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{page}</strong>
          </div>
          <div className="topbar-right">
            <div className="system-status">
              <span className="status-dot" /> Live API
            </div>
          </div>
        </header>

        <div className="page-content">
          <div className="welcome-row">
            <div>
              <div className="eyebrow">SOCIETY OPERATIONS</div>
              <h2>{page}</h2>
              <p className="page-description">Manage your community's access records.</p>
            </div>
            <button className="primary-button" onClick={() => void loadAll()}>
              Refresh Data
            </button>
          </div>

          {message && (
            <div className="form-notice" style={{ marginBottom: 16 }}>
              {message}
            </div>
          )}

          {page === "Dashboard" && renderDashboard()}
          {page === "Flats" && renderFlats()}
          {page === "Residents" && renderResidents()}
          {page === "Service Providers" && renderProviders()}
          {page === "Visitors" && renderVisitors()}
          {page === "Access Logs" && renderAccessLogs()}

          <section className="panel" style={{ padding: 24, marginTop: 24 }}>
            <h3>Gate QR Scanner</h3>
            <p>Scan a flat QR or service-provider QR to verify it.</p>
            <button type="button" onClick={() => {
              setScanResult("");
              setScanEnabled((current) => !current);
            }}>
              {scanEnabled ? "Stop Scanner" : "Start Scanner"}
            </button>
            {scanEnabled && <div id="gatepass-scanner" style={{ maxWidth: 420, marginTop: 16 }} />}
            {scanResult && <p>{scanResult}</p>}
          </section>
        </div>
      </main>
    </div>
  );
}
