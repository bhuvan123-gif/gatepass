import { useCallback, useEffect, useState } from "react";
import {
  getFlats, createFlat, getResidents, createResident, getVisitors,
  createVisitor, checkoutVisitor, getSecondaryPeople, createSecondaryPerson,
  deactivateSecondaryPerson, type Flat, type Resident, type Visitor,
  type SecondaryPerson,
} from "./api";
import {
  LayoutDashboard, Users, UserRoundCog, ClipboardList, ShieldCheck,
  Settings, Search, Bell, Plus, ArrowUpRight, ArrowDownRight, Clock,
  Car, Menu, X,
} from "lucide-react";

const navigation = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Residents", icon: Users },
  { label: "Service Providers", icon: UserRoundCog },
  { label: "Visitors", icon: ClipboardList },
  { label: "Access Logs", icon: ShieldCheck },
  { label: "Settings", icon: Settings },
];

export default function App() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [search, setSearch] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [showVisitorForm, setShowVisitorForm] = useState(false);
  const [visitorFlatId, setVisitorFlatId] = useState("");
  const [visitorSubmitting, setVisitorSubmitting] = useState(false);

  const [flats, setFlats] = useState<Flat[]>([]);
  const [flatsLoading, setFlatsLoading] = useState(true);
  const [flatsError, setFlatsError] = useState("");
  const [flatNumber, setFlatNumber] = useState("");
  const [building, setBuilding] = useState("");
  const [flatMessage, setFlatMessage] = useState("");

  const [residents, setResidents] = useState<Resident[]>([]);
  const [residentsLoading, setResidentsLoading] = useState(true);
  const [residentsError, setResidentsError] = useState("");
  const [residentName, setResidentName] = useState("");
  const [residentFlatId, setResidentFlatId] = useState("");
  const [residentPhone, setResidentPhone] = useState("");
  const [residentMessage, setResidentMessage] = useState("");

  const [secondaryPeople, setSecondaryPeople] = useState<SecondaryPerson[]>([]);
  const [secondaryLoading, setSecondaryLoading] = useState(true);
  const [secondaryError, setSecondaryError] = useState("");
  const [secondaryName, setSecondaryName] = useState("");
  const [secondaryPhone, setSecondaryPhone] = useState("");
  const [secondaryCategory, setSecondaryCategory] = useState("Maid");
  const [secondaryResidentId, setSecondaryResidentId] = useState("");
  const [secondaryMessage, setSecondaryMessage] = useState("");
  const [newProviderQR, setNewProviderQR] = useState("");

  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [visitorsLoading, setVisitorsLoading] = useState(true);
  const [visitorsError, setVisitorsError] = useState("");
  const [visitorActionId, setVisitorActionId] = useState<number | null>(null);

  const loadVisitors = useCallback(async () => {
    try {
      setVisitors(await getVisitors());
      setVisitorsError("");
    } catch (error) {
      console.error("Failed to load visitors:", error);
      setVisitorsError(error instanceof Error ? error.message : "Could not load visitors.");
    } finally {
      setVisitorsLoading(false);
    }
  }, []);

  const loadSecondaryPeople = useCallback(async () => {
    try {
      setSecondaryPeople(await getSecondaryPeople());
      setSecondaryError("");
    } catch (error) {
      console.error("Failed to load service providers:", error);
      setSecondaryError(error instanceof Error ? error.message : "Could not load service providers.");
    } finally {
      setSecondaryLoading(false);
    }
  }, []);

  useEffect(() => {
    getFlats()
      .then((data) => { setFlats(data); setFlatsError(""); })
      .catch((error) => {
        console.error("Failed to load flats:", error);
        setFlatsError(error instanceof Error ? error.message : "Could not load flats.");
      })
      .finally(() => setFlatsLoading(false));

    getResidents()
      .then((data) => { setResidents(data); setResidentsError(""); })
      .catch((error) => {
        console.error("Failed to load residents:", error);
        setResidentsError(error instanceof Error ? error.message : "Could not load residents.");
      })
      .finally(() => setResidentsLoading(false));

    void loadVisitors();
    void loadSecondaryPeople();
  }, [loadVisitors, loadSecondaryPeople]);

  const today = new Date().toDateString();
  const stats = [
    { label: "Total Visitors", value: String(visitors.length), icon: Users, color: "blue", change: "All registered visitors" },
    { label: "Currently Inside", value: String(visitors.filter((v) => v.status === "Inside").length), icon: ShieldCheck, color: "green", change: "Currently on premises" },
    { label: "Today's Visitors", value: String(visitors.filter((v) => new Date(v.created_at).toDateString() === today).length), icon: Clock, color: "orange", change: "Registered today" },
    { label: "Registered Flats", value: String(flats.length), icon: LayoutDashboard, color: "purple", change: "Flats in database" },
  ];

  const filteredVisitors = visitors.filter((visitor) =>
    [visitor.full_name, visitor.flat_number, visitor.building ?? "", visitor.purpose, visitor.status]
      .join(" ").toLowerCase().includes(search.toLowerCase())
  );

  async function handleRegisterVisitor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (visitorSubmitting) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const fullName = String(data.get("visitorName") ?? "").trim();
    const phone = String(data.get("phone") ?? "").trim();
    const purpose = String(data.get("purpose") ?? "").trim();
    const flatId = Number(visitorFlatId);

    if (!fullName || !phone || !purpose || !Number.isInteger(flatId)) {
      alert("Please complete all visitor details.");
      return;
    }
    if (!flats.some((flat) => flat.id === flatId)) {
      alert("Please select a valid registered flat.");
      return;
    }

    setVisitorSubmitting(true);
    try {
      await createVisitor(fullName, flatId, phone, purpose);
      await loadVisitors();
      form.reset();
      setVisitorFlatId("");
      setShowVisitorForm(false);
      setActivePage("Visitors");
      alert("Visitor registered successfully!");
    } catch (error) {
      console.error("Visitor registration failed:", error);
      alert(error instanceof Error ? `Registration failed: ${error.message}` : "Visitor registration failed. Please try again.");
    } finally {
      setVisitorSubmitting(false);
    }
  }

  async function handleCheckout(visitor: Visitor) {
    if (visitorActionId !== null) return;
    if (!window.confirm(`Check out ${visitor.full_name}?`)) return;
    setVisitorActionId(visitor.id);
    try {
      await checkoutVisitor(visitor.id);
      await loadVisitors();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not check out visitor.");
    } finally {
      setVisitorActionId(null);
    }
  }

  async function handleCreateSecondaryPerson(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const resident = residents.find((r) => r.id === Number(secondaryResidentId));
    if (!resident) {
      setSecondaryMessage("Please select a valid resident.");
      return;
    }

    setSecondaryMessage("Registering service provider...");
    try {
      const created = await createSecondaryPerson({
        full_name: secondaryName.trim(),
        phone: secondaryPhone.trim(),
        category: secondaryCategory,
        resident_id: resident.id,
        flat_id: resident.flat_id,
      });
      setSecondaryPeople((current) => [...current, created]);
      setNewProviderQR(created.qr_token);
      setSecondaryName("");
      setSecondaryPhone("");
      setSecondaryResidentId("");
      setSecondaryCategory("Maid");
      setSecondaryMessage("Service provider registered successfully!");
    } catch (error) {
      console.error("Service provider registration failed:", error);
      setSecondaryMessage(error instanceof Error ? error.message : "Could not register service provider.");
    }
  }

  async function handleDeactivateSecondaryPerson(personId: number) {
    try {
      await deactivateSecondaryPerson(personId);
      await loadSecondaryPeople();
      setSecondaryMessage("Service provider deactivated.");
    } catch (error) {
      console.error("Service provider deactivation failed:", error);
      setSecondaryMessage(error instanceof Error ? error.message : "Could not deactivate service provider.");
    }
  }

  function renderVisitorsTable() {
    return (
      <article className="panel visitor-panel">
        <div className="panel-heading">
          <div>
            <h3>{activePage === "Dashboard" ? "Recent Visitors" : "Visitor Records"}</h3>
            <p>Visitor activity retrieved from the GatePass database</p>
          </div>
          <span className="live-tag">DATABASE</span>
        </div>
        <div className="table-toolbar">
          <div className="search-box">
            <Search size={17} />
            <input type="search" placeholder="Search visitors or flats..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <span className="records-label">{filteredVisitors.length} records</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>VISITOR</th><th>DESTINATION</th><th>PURPOSE</th><th>ARRIVAL</th><th>STATUS / ACTION</th></tr></thead>
            <tbody>
              {visitorsLoading && <tr><td colSpan={5} className="empty-state">Loading visitors...</td></tr>}
              {!visitorsLoading && visitorsError && (
                <tr><td colSpan={5} className="empty-state">{visitorsError} <button type="button" onClick={() => void loadVisitors()}>Retry</button></td></tr>
              )}
              {!visitorsLoading && !visitorsError && filteredVisitors.map((visitor) => (
                <tr key={visitor.id}>
                  <td>
                    <div className="visitor-person">
                      <div className="avatar visitor-avatar">
                        {visitor.full_name.split(/\s+/).map((part) => part[0] ?? "").join("").slice(0, 2).toUpperCase()}
                      </div>
                      <span>{visitor.full_name}</span>
                    </div>
                  </td>
                  <td className="flat-number">{visitor.building ? `${visitor.building} - ${visitor.flat_number}` : visitor.flat_number}</td>
                  <td>{visitor.purpose}</td>
                  <td>{new Date(visitor.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</td>
                  <td>
                    <span className={`badge ${visitor.status === "Inside" ? "badge-green" : "badge-gray"}`}>
                      <span className="badge-dot" />{visitor.status}
                    </span>
                    {visitor.status === "Inside" && (
                      <button type="button" disabled={visitorActionId !== null} onClick={() => void handleCheckout(visitor)}>
                        {visitorActionId === visitor.id ? "Checking out..." : "Check Out"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!visitorsLoading && !visitorsError && filteredVisitors.length === 0 && (
                <tr><td colSpan={5} className="empty-state">No matching visitors found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="panel-footer">{visitors.length} visitor records · Live database</div>
      </article>
    );
  }

  function renderFlats() {
    return (
      <section className="panel" style={{ padding: 24 }}>
        <div className="panel-heading">
          <div><h3>Registered Flats</h3><p>Manage flats stored in the GatePass database</p></div>
          <span className="live-tag">DATABASE</span>
        </div>
        <form onSubmit={async (event) => {
          event.preventDefault();
          setFlatMessage("Registering flat...");
          try {
            const newFlat = await createFlat(flatNumber.trim(), building.trim());
            setFlats((current) => [...current, newFlat]);
            setFlatNumber(""); setBuilding("");
            setFlatMessage("Flat registered successfully!");
            setFlatsError("");
          } catch (error) {
            setFlatMessage(error instanceof Error ? error.message : "Could not register flat.");
          }
        }} style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <input value={flatNumber} onChange={(event) => setFlatNumber(event.target.value)} placeholder="Flat number (e.g. A-101)" required maxLength={30} />
          <input value={building} onChange={(event) => setBuilding(event.target.value)} placeholder="Building / tower (optional)" maxLength={60} />
          <button type="submit">Register Flat</button>
        </form>
        {flatMessage && <p>{flatMessage}</p>}
        {flatsLoading && <p>Loading flats...</p>}
        {flatsError && <p>{flatsError}</p>}
        {!flatsLoading && !flatsError && flats.length === 0 && <p>No flats registered yet.</p>}
        {!flatsLoading && !flatsError && flats.map((flat) => (
          <div key={flat.id} style={{ padding: "12px 0", borderBottom: "1px solid #eee" }}>
            <strong>{flat.flat_number}</strong>{flat.building && <span> — {flat.building}</span>}
          </div>
        ))}
      </section>
    );
  }

  function renderResidents() {
    return (
      <section className="panel" style={{ padding: 24 }}>
        <div className="panel-heading">
          <div><h3>Resident Management</h3><p>Register residents and assign them to flats</p></div>
          <span className="live-tag">DATABASE</span>
        </div>
        <form onSubmit={async (event) => {
          event.preventDefault();
          setResidentMessage("Registering resident...");
          try {
            const newResident = await createResident(residentName.trim(), Number(residentFlatId), residentPhone.trim());
            setResidents((current) => [...current, newResident]);
            setResidentName(""); setResidentFlatId(""); setResidentPhone("");
            setResidentMessage("Resident registered successfully!");
            setResidentsError("");
          } catch (error) {
            setResidentMessage(error instanceof Error ? error.message : "Could not register resident.");
          }
        }} style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <input value={residentName} onChange={(event) => setResidentName(event.target.value)} placeholder="Resident full name" required maxLength={100} />
          <select value={residentFlatId} onChange={(event) => setResidentFlatId(event.target.value)} required>
            <option value="">Select flat</option>
            {flats.map((flat) => <option key={flat.id} value={flat.id}>{flat.flat_number}{flat.building ? ` — ${flat.building}` : ""}</option>)}
          </select>
          <input value={residentPhone} onChange={(event) => setResidentPhone(event.target.value)} placeholder="Phone (optional)" maxLength={20} />
          <button type="submit" disabled={flats.length === 0}>Register Resident</button>
        </form>
        {flats.length === 0 && !flatsLoading && <p>Register a flat first before adding residents.</p>}
        {residentMessage && <p>{residentMessage}</p>}
        {residentsLoading && <p>Loading residents...</p>}
        {residentsError && <p>{residentsError}</p>}
        {!residentsLoading && !residentsError && residents.length === 0 && <p>No residents registered yet.</p>}
        {!residentsLoading && !residentsError && residents.map((resident) => (
          <div key={resident.id} style={{ padding: "12px 0", borderBottom: "1px solid #eee" }}>
            <strong>{resident.full_name}</strong>
            <div>Flat {resident.flat_number}{resident.building ? ` — ${resident.building}` : ""}</div>
            {resident.phone && <div>{resident.phone}</div>}
          </div>
        ))}
      </section>
    );
  }

  return (
    <div className="app-shell">
      {mobileMenu && <button className="mobile-overlay" aria-label="Close menu" onClick={() => setMobileMenu(false)} />}
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><ShieldCheck size={25} /></div>
          <div><h1>GatePass</h1><span>COMMUNITY MANAGEMENT</span></div>
          <button className="icon-button mobile-close" onClick={() => setMobileMenu(false)} aria-label="Close navigation"><X size={20} /></button>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="navigation">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.label} className={`nav-item ${activePage === item.label ? "nav-active" : ""}`} onClick={() => { setActivePage(item.label); setMobileMenu(false); }}>
                <Icon size={19} /><span>{item.label}</span>
                {item.label === "Visitors" && <span className="nav-count">{visitors.length}</span>}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="security-card">
            <div className="security-icon"><ShieldCheck size={20} /></div>
            <strong>Security overview</strong>
            <p>Access monitoring dashboard</p>
            <div className="security-status"><span className="status-dot" />Development preview</div>
          </div>
          <div className="profile">
            <div className="avatar admin-avatar">AD</div>
            <div className="profile-info"><strong>Society Admin</strong><span>Administrator</span></div>
            <Settings size={18} className="profile-settings" />
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu-button" aria-label="Open navigation" onClick={() => setMobileMenu(true)}><Menu size={22} /></button>
          <div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-divider">/</span><strong>{activePage}</strong></div>
          <div className="topbar-right">
            <div className="system-status"><span className="status-dot" />Preview mode</div>
            <button className="icon-button notification-button" aria-label="Notifications" onClick={() => alert("Notifications have not been connected yet.")}><Bell size={19} /><span className="notification-dot" /></button>
            <div className="avatar top-avatar">AD</div>
          </div>
        </header>

        <div className="page-content">
          <div className="welcome-row">
            <div>
              <div className="eyebrow">SOCIETY OPERATIONS</div>
              <h2>{activePage}</h2>
              <p className="page-description">
                {activePage === "Dashboard" ? "Here's what's happening in your community today." : `Manage your community's ${activePage.toLowerCase()} records.`}
              </p>
            </div>
            <button type="button" className="primary-button" style={{ position: "relative", zIndex: 10, pointerEvents: "auto", cursor: "pointer" }} onClick={() => { console.log("Register Visitor clicked"); setShowVisitorForm(true); }}>
              <Plus size={18} />{activePage === "Dashboard" || activePage === "Visitors" ? "Register Visitor" : "Quick Action"}
            </button>
          </div>

          {activePage === "Dashboard" && (
            <>
              <section className="stats-grid">
                {stats.map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <article className="stat-card" key={stat.label}>
                      <div className="stat-top"><div className={`stat-icon ${stat.color}`}><Icon size={21} /></div><span className="stat-period">Live</span></div>
                      <div className="stat-value">{stat.value}</div>
                      <div className="stat-label">{stat.label}</div>
                      <div className="stat-footer"><span>{stat.change}</span><ArrowUpRight size={16} /></div>
                    </article>
                  );
                })}
              </section>

              <section className="overview-grid">
                {renderVisitorsTable()}
                <article className="panel activity-panel">
                  <div className="panel-heading"><div><h3>Access Overview</h3><p>Based on registered visitor records</p></div><span className="live-tag">LIVE</span></div>
                  <div className="activity-metric"><div className="metric-icon entry-icon"><ArrowDownRight size={19} /></div><div className="metric-details"><span>Currently inside</span><strong>{visitors.filter((v) => v.status === "Inside").length}</strong></div></div>
                  <div className="activity-metric"><div className="metric-icon exit-icon"><ArrowUpRight size={19} /></div><div className="metric-details"><span>Checked out</span><strong>{visitors.filter((v) => v.status === "Checked Out").length}</strong></div></div>
                  <div className="security-note"><ShieldCheck size={19} /><div><strong>Visitor tracking</strong><p>Registration and checkout records come from the API.</p></div></div>
                </article>
              </section>

              <section className="bottom-grid">
                <article className="panel quick-panel">
                  <div className="panel-heading"><div><h3>Quick Actions</h3><p>Common management tasks</p></div></div>
                  <div className="quick-actions">
                    <button className="quick-action" onClick={() => setShowVisitorForm(true)}><div className="quick-icon quick-blue"><Plus size={20} /></div><span><strong>Register Visitor</strong><small>Record a new arrival</small></span><ArrowUpRight size={17} /></button>
                    <button className="quick-action" onClick={() => setActivePage("Residents")}><div className="quick-icon quick-purple"><Users size={20} /></div><span><strong>Manage Residents</strong><small>Residents and flat records</small></span><ArrowUpRight size={17} /></button>
                    <button className="quick-action" onClick={() => setActivePage("Access Logs")}><div className="quick-icon quick-green"><Clock size={20} /></div><span><strong>View Access Logs</strong><small>Review entry and exit history</small></span><ArrowUpRight size={17} /></button>
                  </div>
                </article>
                <article className="panel vehicle-panel">
                  <div className="panel-heading"><div><h3>Gate Operations</h3><p>Planned guard-interface features</p></div><Car size={20} /></div>
                  <div className="gate-feature"><div className="gate-feature-icon"><ShieldCheck size={19} /></div><div><strong>QR verification</strong><p>QR-based identity verification is not implemented yet.</p></div></div>
                  <div className="gate-feature"><div className="gate-feature-icon"><ClipboardList size={19} /></div><div><strong>Visitor registration</strong><p>Visitor records are saved through the API.</p></div></div>
                </article>
              </section>
              <div style={{ marginTop: 24 }}>{renderFlats()}</div>
              <div style={{ marginTop: 24 }}>{renderResidents()}</div>
            </>
          )}

          {activePage === "Visitors" && renderVisitorsTable()}
          {activePage === "Residents" && <div id="resident-management">{renderResidents()}</div>}

          {activePage === "Service Providers" && (
            <section className="panel" style={{ padding: 24 }}>
              <div className="panel-heading">
                <div><h3>Service Provider Management</h3><p>Register and manage recurring service providers.</p></div>
                <span className="live-tag">DATABASE</span>
              </div>
              <form onSubmit={handleCreateSecondaryPerson} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 500, marginBottom: 24 }}>
                <input value={secondaryName} onChange={(event) => setSecondaryName(event.target.value)} placeholder="Full name" required maxLength={100} />
                <input value={secondaryPhone} onChange={(event) => setSecondaryPhone(event.target.value)} placeholder="Phone number" maxLength={20} />
                <select value={secondaryCategory} onChange={(event) => setSecondaryCategory(event.target.value)}>
                  <option value="Maid">Maid</option><option value="Milkman">Milkman</option><option value="Vendor">Vendor</option><option value="Driver">Driver</option><option value="Other">Other</option>
                </select>
                <select value={secondaryResidentId} onChange={(event) => setSecondaryResidentId(event.target.value)} required>
                  <option value="">Select linked resident</option>
                  {residents.map((resident) => <option key={resident.id} value={resident.id}>{resident.full_name} — {resident.flat_number}</option>)}
                </select>
                <button type="submit" disabled={residents.length === 0}>Register Service Provider</button>
              </form>
              {secondaryMessage && <p>{secondaryMessage}</p>}
              {newProviderQR && (
                <div style={{ padding: 16, background: "#f0fdf4", marginBottom: 20 }}>
                  <strong>New provider QR token</strong>
                  <p style={{ overflowWrap: "anywhere" }}>{newProviderQR}</p>
                  <small>Keep this token private. A scannable QR display will be added separately.</small>
                </div>
              )}
              <h3>Registered Providers</h3>
              {secondaryLoading && <p>Loading providers...</p>}
              {secondaryError && <p>{secondaryError}</p>}
              {!secondaryLoading && !secondaryError && secondaryPeople.map((person) => (
                <div key={person.id} style={{ padding: 14, borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div>
                    <strong>{person.full_name}</strong>
                    <p>{person.category} · {person.flat_number ?? "Flat unavailable"}</p>
                    <small>{person.active ? "Active" : "Inactive"}</small>
                  </div>
                  {person.active && <button type="button" onClick={() => void handleDeactivateSecondaryPerson(person.id)}>Deactivate</button>}
                </div>
              ))}
              {!secondaryLoading && !secondaryError && secondaryPeople.length === 0 && <p>No service providers registered yet.</p>}
            </section>
          )}

          {activePage === "Access Logs" && (
            <section className="panel placeholder-panel">
              <div className="placeholder-icon"><ShieldCheck size={27} /></div>
              <h3>Access Logs</h3>
              <p>Visitor arrival and checkout times are stored in visitor records. A dedicated searchable audit log is not implemented yet.</p>
              <button className="secondary-button" onClick={() => setActivePage("Visitors")}>View visitor records</button>
            </section>
          )}

          {activePage === "Settings" && (
            <section className="panel placeholder-panel">
              <div className="placeholder-icon"><Settings size={27} /></div>
              <h3>Settings</h3>
              <p>Authentication, roles, and society settings are not implemented yet.</p>
              <span className="coming-soon">INTERFACE IN DEVELOPMENT</span>
            </section>
          )}
        </div>
      </main>

      {showVisitorForm && (
        <div className="modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setShowVisitorForm(false); }}>
          <form className="visitor-modal" onSubmit={handleRegisterVisitor}>
            <div className="modal-heading">
              <div><span className="eyebrow">GATE OPERATIONS</span><h3>Register Visitor</h3></div>
              <button type="button" className="icon-button" onClick={() => setShowVisitorForm(false)} disabled={visitorSubmitting} aria-label="Close form"><X size={20} /></button>
            </div>
            <label>Visitor name<input name="visitorName" required maxLength={100} placeholder="Enter full name" /></label>
            <label>Contact number<input name="phone" required type="tel" inputMode="tel" maxLength={20} placeholder="Enter phone number" /></label>
            <label>Destination flat
              <select name="destination" value={visitorFlatId} onChange={(event) => setVisitorFlatId(event.target.value)} required disabled={flatsLoading || flats.length === 0 || visitorSubmitting}>
                <option value="">{flatsLoading ? "Loading flats..." : "Select destination flat"}</option>
                {flats.map((flat) => <option key={flat.id} value={flat.id}>{flat.building ? `${flat.building} - ${flat.flat_number}` : flat.flat_number}</option>)}
              </select>
            </label>
            <label>Purpose of visit
              <select name="purpose" required defaultValue="">
                <option value="" disabled>Select purpose</option>
                <option value="Personal Visit">Personal Visit</option><option value="Delivery">Delivery</option><option value="Maintenance">Maintenance</option><option value="Service Provider">Service Provider</option><option value="Other">Other</option>
              </select>
            </label>
            <div className="form-notice">Development preview. Use fictional test information only.</div>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setShowVisitorForm(false)} disabled={visitorSubmitting}>Cancel</button>
              <button type="submit" className="primary-button" disabled={visitorSubmitting || flatsLoading || flats.length === 0}>{visitorSubmitting ? "Registering..." : "Register Visitor"}</button>
            </div>
          </form>
        </div>
      )}

      <footer className="app-footer">
        <span>GatePass © 2026</span>
        <span>Society access management · Development preview</span>
      </footer>
    </div>
  );
}
