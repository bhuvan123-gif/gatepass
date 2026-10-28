import {
  getFlats,
  createFlat,
  getResidents,
  createResident,
  type Flat,
  type Resident,
} from "./api";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  UserRoundCog,
  ClipboardList,
  ShieldCheck,
  Settings,
  Search,
  Bell,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Car,
  Menu,
  X,
} from "lucide-react";

const navigation = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Residents", icon: Users },
  { label: "Service Providers", icon: UserRoundCog },
  { label: "Visitors", icon: ClipboardList },
  { label: "Access Logs", icon: ShieldCheck },
  { label: "Settings", icon: Settings },
];

const visitors = [
  {
    name: "Rahul Sharma",
    initials: "RS",
    flat: "A-204",
    purpose: "Personal Visit",
    time: "10:42 AM",
    status: "Inside",
  },
  {
    name: "Amit Kumar",
    initials: "AK",
    flat: "B-108",
    purpose: "Delivery",
    time: "10:28 AM",
    status: "Inside",
  },
  {
    name: "Priya Singh",
    initials: "PS",
    flat: "C-302",
    purpose: "Guest",
    time: "10:15 AM",
    status: "Exited",
  },
  {
    name: "Vikram Verma",
    initials: "VV",
    flat: "A-105",
    purpose: "Maintenance",
    time: "09:56 AM",
    status: "Inside",
  },
];

const stats = [
  {
    label: "Total Residents",
    value: "248",
    change: "Registered members",
    icon: Users,
    color: "blue",
  },
  {
    label: "Service Providers",
    value: "36",
    change: "Regular staff",
    icon: UserRoundCog,
    color: "purple",
  },
  {
    label: "Today's Visitors",
    value: "42",
    change: "Visitor registrations",
    icon: ClipboardList,
    color: "orange",
  },
  {
    label: "Currently Inside",
    value: "18",
    change: "Active visitor entries",
    icon: ShieldCheck,
    color: "green",
  },
];

export default function App() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [search, setSearch] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [showVisitorForm, setShowVisitorForm] = useState(false);
  const [flatNumber, setFlatNumber] = useState("");
const [building, setBuilding] = useState("");
const [flatMessage, setFlatMessage] = useState("");
    const [flats, setFlats] = useState<Flat[]>([]);
  const [flatsLoading, setFlatsLoading] = useState(true);
  const [flatsError, setFlatsError] = useState("");
  const [residents, setResidents] = useState<Resident[]>([]);
const [residentName, setResidentName] = useState("");
const [residentFlatId, setResidentFlatId] = useState("");
const [residentPhone, setResidentPhone] = useState("");
const [residentMessage, setResidentMessage] = useState("");
const [residentsLoading, setResidentsLoading] = useState(true);
const [residentsError, setResidentsError] = useState("");

  useEffect(() => {
    getFlats()
      .then((data) => {
        setFlats(data);
        setFlatsError("");
      })
      .catch((error) => {
        console.error("Failed to load flats:", error);
        setFlatsError("Could not load flats from the API.");
      })
      .finally(() => {
        setFlatsLoading(false);
      });
  }, []);
  useEffect(() => {
  getResidents()
    .then((data) => {
      setResidents(data);
      setResidentsError("");
    })
    .catch((error) => {
      console.error("Failed to load residents:", error);
      setResidentsError("Could not load residents from the API.");
    })
    .finally(() => {
      setResidentsLoading(false);
    });
}, []);

  const filteredVisitors = visitors.filter((visitor) =>
    [
      visitor.name,
      visitor.flat,
      visitor.purpose,
      visitor.status,
    ]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

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
          <div className="brand-mark">
            <ShieldCheck size={25} />
          </div>
          <div>
            <h1>GatePass</h1>
            <span>COMMUNITY MANAGEMENT</span>
          </div>
          <button
            className="icon-button mobile-close"
            onClick={() => setMobileMenu(false)}
            aria-label="Close navigation"
          >
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
                className={`nav-item ${
                  activePage === item.label ? "nav-active" : ""
                }`}
                onClick={() => {
                  setActivePage(item.label);
                  setMobileMenu(false);
                }}
              >
                <Icon size={19} />
                <span>{item.label}</span>
                {item.label === "Visitors" && (
                  <span className="nav-count">12</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="security-card">
            <div className="security-icon">
              <ShieldCheck size={20} />
            </div>
            <strong>Security overview</strong>
            <p>Access monitoring dashboard</p>
            <div className="security-status">
              <span className="status-dot" />
              Demo interface
            </div>
          </div>

          <div className="profile">
            <div className="avatar admin-avatar">AD</div>
            <div className="profile-info">
              <strong>Society Admin</strong>
              <span>Administrator</span>
            </div>
            <Settings size={18} className="profile-settings" />
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button
            className="icon-button mobile-menu-button"
            aria-label="Open navigation"
            onClick={() => setMobileMenu(true)}
          >
            <Menu size={22} />
          </button>

          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{activePage}</strong>
          </div>

          <div className="topbar-right">
            <div className="system-status">
              <span className="status-dot" />
              Preview mode
            </div>
            <button
              className="icon-button notification-button"
              aria-label="Notifications"
              onClick={() => alert("Notifications will be connected later.")}
            >
              <Bell size={19} />
              <span className="notification-dot" />
            </button>
            <div className="avatar top-avatar">AD</div>
          </div>
        </header>

        <div className="page-content">
          <div className="welcome-row">
            <div>
              <div className="eyebrow">SOCIETY OPERATIONS</div>
              <h2>{activePage}</h2>
              <p className="page-description">
                {activePage === "Dashboard"
                  ? "Here's what's happening in your community today."
                  : `Manage your community's ${activePage.toLowerCase()} records.`}
              </p>
            </div>

            <button
              className="primary-button"
              onClick={() => {
                if (activePage === "Visitors" || activePage === "Dashboard") {
                  setShowVisitorForm(true);
                } else {
                  alert(
                    `${activePage} management will be connected to the backend next.`
                  );
                }
              }}
            >
              <Plus size={18} />
              {activePage === "Visitors" ? "Register Visitor" : "Quick Action"}
            </button>
          </div>

          {activePage === "Dashboard" ? (
            <>
            
<section className="panel" style={{ marginBottom: 24, padding: 24 }}>
  <div className="panel-heading">
    <div>
      <h3>Registered Flats</h3>
      <p>Flats retrieved from the GatePass database</p>
    </div>
    <span className="live-tag">DATABASE</span>
  </div>

  <form
    onSubmit={async (e) => {
      e.preventDefault();
      setFlatMessage("Registering flat...");

      try {
        const newFlat = await createFlat(flatNumber.trim(), building.trim());
        setFlats((current) => [...current, newFlat]);
        setFlatNumber("");
        setBuilding("");
        setFlatMessage("Flat registered successfully!");
      } catch (error) {
        setFlatMessage(
          error instanceof Error ? error.message : "Could not register flat."
        );
      }
    }}
    style={{
      display: "flex",
      gap: 12,
      flexWrap: "wrap",
      marginBottom: 20,
    }}
  >
    <input
      value={flatNumber}
      onChange={(e) => setFlatNumber(e.target.value)}
      placeholder="Flat number (e.g. A-101)"
      required
      style={{
        padding: 12,
        border: "1px solid #ccc",
        borderRadius: 8,
        minWidth: 200,
        color: "#111",
        background: "#fff",
      }}
    />
    <input
      value={building}
      onChange={(e) => setBuilding(e.target.value)}
      placeholder="Building (e.g. Tower A)"
      style={{
        padding: 12,
        border: "1px solid #ccc",
        borderRadius: 8,
        minWidth: 200,
        color: "#111",
        background: "#fff",
      }}
    />
    <button type="submit" style={{ padding: "12px 20px", borderRadius: 8 }}>
      Register Flat
    </button>
  </form>

  {flatMessage && <p>{flatMessage}</p>}
  {flatsLoading && <p>Loading flats...</p>}
  {flatsError && <p>{flatsError}</p>}

  {!flatsLoading && !flatsError && flats.length === 0 && (
    <p>No flats registered yet.</p>
  )}

  {!flatsLoading && !flatsError && flats.map((flat) => (
    <div key={flat.id} style={{ padding: "12px 0", borderBottom: "1px solid #eee" }}>
      <strong>{flat.flat_number}</strong>
      {flat.building && <span> — {flat.building}</span>}
    </div>
  ))}
</section>

<section className="panel" style={{ marginBottom: 24, padding: 24 }}>
  <div className="panel-heading">
    <div>
      <h3>Resident Management</h3>
      <p>Register residents and assign them to flats</p>
    </div>
    <span className="live-tag">DATABASE</span>
  </div>

  <form
    onSubmit={async (e) => {
      e.preventDefault();
      setResidentMessage("Registering resident...");

      try {
        const newResident = await createResident(
          residentName.trim(),
          Number(residentFlatId),
          residentPhone.trim()
        );

        setResidents((current) => [...current, newResident]);
        setResidentName("");
        setResidentFlatId("");
        setResidentPhone("");
        setResidentMessage("Resident registered successfully!");
      } catch (error) {
        setResidentMessage(
          error instanceof Error ? error.message : "Could not register resident."
        );
      }
    }}
    style={{
      display: "flex",
      gap: 12,
      flexWrap: "wrap",
      marginBottom: 20,
    }}
  >
    <input
      value={residentName}
      onChange={(e) => setResidentName(e.target.value)}
      placeholder="Resident full name"
      required
      maxLength={100}
      style={{ padding: 12, border: "1px solid #ccc", borderRadius: 8, color: "#111", background: "#fff" }}
    />

    <select
      value={residentFlatId}
      onChange={(e) => setResidentFlatId(e.target.value)}
      required
      style={{ padding: 12, border: "1px solid #ccc", borderRadius: 8, color: "#111", background: "#fff" }}
    >
      <option value="">Select flat</option>
      {flats.map((flat) => (
        <option key={flat.id} value={flat.id}>
          {flat.flat_number}{flat.building ? ` — ${flat.building}` : ""}
        </option>
      ))}
    </select>

    <input
      value={residentPhone}
      onChange={(e) => setResidentPhone(e.target.value)}
      placeholder="Phone (optional)"
      maxLength={20}
      style={{ padding: 12, border: "1px solid #ccc", borderRadius: 8, color: "#111", background: "#fff" }}
    />

    <button type="submit" disabled={flats.length === 0} style={{ padding: "12px 20px", borderRadius: 8 }}>
      Register Resident
    </button>
  </form>

  {flats.length === 0 && !flatsLoading && (
    <p>Register a flat first before adding residents.</p>
  )}
  {residentMessage && <p>{residentMessage}</p>}
  {residentsLoading && <p>Loading residents...</p>}
  {residentsError && <p>{residentsError}</p>}

  {!residentsLoading && !residentsError && residents.length === 0 && (
    <p>No residents registered yet.</p>
  )}

  {!residentsLoading && !residentsError && residents.map((resident) => (
    <div key={resident.id} style={{ padding: "12px 0", borderBottom: "1px solid #eee" }}>
      <strong>{resident.full_name}</strong>
      <div>
        Flat {resident.flat_number}
        {resident.building ? ` — ${resident.building}` : ""}
      </div>
      {resident.phone && <div>{resident.phone}</div>}
    </div>
  ))}
</section>

<section className="stats-grid">

                {stats.map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <article className="stat-card" key={stat.label}>
                      <div className="stat-top">
                        <div className={`stat-icon ${stat.color}`}>
                          <Icon size={21} />
                        </div>
                        <span className="stat-period">Today</span>
                      </div>
                      <div className="stat-value">{stat.value}</div>
                      <div className="stat-label">{stat.label}</div>
                      <div className="stat-footer">
                        <span>{stat.change}</span>
                        <ArrowUpRight size={16} />
                      </div>
                    </article>
                  );
                })}
              </section>

              <section className="overview-grid">
                <article className="panel visitor-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Recent Visitors</h3>
                      <p>Latest visitor activity at your society</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setActivePage("Visitors")}
                    >
                      View all <ArrowUpRight size={15} />
                    </button>
                  </div>

                  <div className="table-toolbar">
                    <div className="search-box">
                      <Search size={17} />
                      <input
                        type="search"
                        placeholder="Search visitors or flats..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                      />
                    </div>
                    <span className="records-label">
                      {filteredVisitors.length} records
                    </span>
                  </div>

                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>VISITOR</th>
                          <th>DESTINATION</th>
                          <th>PURPOSE</th>
                          <th>ARRIVAL</th>
                          <th>STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredVisitors.map((visitor) => (
                          <tr key={visitor.name}>
                            <td>
                              <div className="visitor-person">
                                <div className="avatar visitor-avatar">
                                  {visitor.initials}
                                </div>
                                <span>{visitor.name}</span>
                              </div>
                            </td>
                            <td className="flat-number">{visitor.flat}</td>
                            <td>{visitor.purpose}</td>
                            <td>{visitor.time}</td>
                            <td>
                              <span
                                className={`badge ${
                                  visitor.status === "Inside"
                                    ? "badge-green"
                                    : "badge-gray"
                                }`}
                              >
                                <span className="badge-dot" />
                                {visitor.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {filteredVisitors.length === 0 && (
                          <tr>
                            <td colSpan={5} className="empty-state">
                              No matching visitors found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="panel-footer">
                    Sample visitor records · Not connected to a database
                  </div>
                </article>

                <article className="panel activity-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Access Overview</h3>
                      <p>Illustrative entry and exit summary</p>
                    </div>
                    <span className="live-tag">DEMO</span>
                  </div>

                  <div className="activity-summary">
                    <div className="activity-number">
                      <span>60</span>
                      <span className="activity-unit">events</span>
                    </div>
                    <span className="activity-caption">
                      Illustrative daily activity
                    </span>
                  </div>

                  <div className="activity-metric">
                    <div className="metric-icon entry-icon">
                      <ArrowDownRight size={19} />
                    </div>
                    <div className="metric-details">
                      <span>Entries recorded</span>
                      <strong>42</strong>
                    </div>
                    <span className="metric-percent">70%</span>
                  </div>

                  <div className="metric-track">
                    <div className="metric-fill entry-fill" />
                  </div>

                  <div className="activity-metric">
                    <div className="metric-icon exit-icon">
                      <ArrowUpRight size={19} />
                    </div>
                    <div className="metric-details">
                      <span>Exits recorded</span>
                      <strong>18</strong>
                    </div>
                    <span className="metric-percent">30%</span>
                  </div>

                  <div className="metric-track">
                    <div className="metric-fill exit-fill" />
                  </div>

                  <div className="security-note">
                    <ShieldCheck size={19} />
                    <div>
                      <strong>Access control</strong>
                      <p>
                        QR verification and entry/exit logging will be
                        implemented in the backend.
                      </p>
                    </div>
                  </div>
                </article>
              </section>

              <section className="bottom-grid">
                <article className="panel quick-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Quick Actions</h3>
                      <p>Common management tasks</p>
                    </div>
                  </div>

                  <div className="quick-actions">
                    <button
                      className="quick-action"
                      onClick={() => setShowVisitorForm(true)}
                    >
                      <div className="quick-icon quick-blue">
                        <Plus size={20} />
                      </div>
                      <span>
                        <strong>Register Visitor</strong>
                        <small>Record a new arrival</small>
                      </span>
                      <ArrowUpRight size={17} />
                    </button>

                    <button
                      className="quick-action"
                      onClick={() => setActivePage("Residents")}
                    >
                      <div className="quick-icon quick-purple">
                        <Users size={20} />
                      </div>
                      <span>
                        <strong>Manage Residents</strong>
                        <small>Residents and flat records</small>
                      </span>
                      <ArrowUpRight size={17} />
                    </button>

                    <button
                      className="quick-action"
                      onClick={() => setActivePage("Access Logs")}
                    >
                      <div className="quick-icon quick-green">
                        <Clock size={20} />
                      </div>
                      <span>
                        <strong>View Access Logs</strong>
                        <small>Review entry and exit history</small>
                      </span>
                      <ArrowUpRight size={17} />
                    </button>
                  </div>
                </article>

                <article className="panel vehicle-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Gate Operations</h3>
                      <p>Features planned for the guard interface</p>
                    </div>
                    <Car size={20} className="muted-icon" />
                  </div>

                  <div className="gate-feature">
                    <div className="gate-feature-icon">
                      <ShieldCheck size={19} />
                    </div>
                    <div>
                      <strong>QR identity verification</strong>
                      <p>Verify active residents and regular providers.</p>
                    </div>
                  </div>

                  <div className="gate-feature">
                    <div className="gate-feature-icon">
                      <ClipboardList size={19} />
                    </div>
                    <div>
                      <strong>Visitor registration</strong>
                      <p>Capture destination flat and arrival details.</p>
                    </div>
                  </div>

                  <div className="gate-feature">
                    <div className="gate-feature-icon">
                      <Car size={19} />
                    </div>
                    <div>
                      <strong>Vehicle records</strong>
                      <p>Support optional vehicle details.</p>
                    </div>
                  </div>
                </article>
              </section>
            </>
          ) : (
            <section className="panel placeholder-panel">
              <div className="placeholder-icon">
                <ShieldCheck size={27} />
              </div>
              <h3>{activePage} management</h3>
              <p>
                This section is ready for development. Next, we'll connect
                its forms and records to the GatePass backend and database.
              </p>
              <span className="coming-soon">INTERFACE IN DEVELOPMENT</span>
              {activePage === "Access Logs" && (
                <button
                  className="secondary-button"
                  onClick={() =>
                    alert("CSV export will be connected to real records later.")
                  }
                >
                  Prepare CSV export
                </button>
              )}
            </section>
          )}
        </div>
      </main>

      {showVisitorForm && (
        <div className="modal-backdrop">
          <form
            className="visitor-modal"
            onSubmit={(event) => {
              event.preventDefault();
              alert(
                "This form is a UI preview only. Visitor records will be saved after database integration."
              );
              setShowVisitorForm(false);
            }}
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">GATE OPERATIONS</span>
                <h3>Register Visitor</h3>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowVisitorForm(false)}
                aria-label="Close form"
              >
                <X size={20} />
              </button>
            </div>

            <label>
              Visitor name
              <input required placeholder="Enter full name" />
            </label>

            <label>
              Contact number
              <input
                required
                type="tel"
                inputMode="tel"
                placeholder="Enter phone number"
              />
            </label>

            <label>
              Destination flat
              <input required placeholder="e.g. A-204" />
            </label>

            <label>
              Purpose of visit
              <select required defaultValue="">
                <option value="" disabled>
                  Select purpose
                </option>
                <option>Personal Visit</option>
                <option>Delivery</option>
                <option>Maintenance</option>
                <option>Service Provider</option>
                <option>Other</option>
              </select>
            </label>

            <div className="form-notice">
              Demo only. Do not enter real visitor information yet.
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowVisitorForm(false)}
              >
                Cancel
              </button>
              <button type="submit" className="primary-button">
                Preview Registration
              </button>
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
