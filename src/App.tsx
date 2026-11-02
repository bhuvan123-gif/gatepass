import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Html5QrcodeScanner } from "html5-qrcode";

import {
  getFlats,
  createFlat,
  deleteFlat,
  generateFlatQR,
  getResidents,
  createResident,
  deleteResident,
  getVisitors,
  createVisitor,
  checkoutVisitor,
  deleteVisitor,
  getSecondaryPeople,
  createSecondaryPerson,
  deleteSecondaryPerson,
  generateSecondaryPersonQR,
  validateQR,
  getCurrentResidentStatus,
  recordResidentMovement,
  getCurrentProviderStatus,
  recordProviderMovement,
  type Flat,
  type Resident,
  type Visitor,
  type SecondaryPerson,
  type MovementAction,
  type FlatQRCreated,
} from "./api";

import {
  LayoutDashboard,
  Users,
  UserRoundCog,
  ClipboardList,
  ShieldCheck,
  Settings,
  Search,
  Plus,
  Trash2,
  Menu,
  X,
  QrCode,
  ArrowDownRight,
  ArrowUpRight,
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

  const [flatQr, setFlatQr] = useState<FlatQRCreated | null>(null);

  const [providerQr, setProviderQr] = useState<{
    name: string;
    token: string;
  } | null>(null);

  const [scanEnabled, setScanEnabled] = useState(false);
  const [scanResult, setScanResult] = useState("");


  // -------------------- LOAD DATA --------------------

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
      setMessage(
        error instanceof Error ? error.message : "Could not load data."
      );
    }
  }, []);


  useEffect(() => {
    void loadAll();
  }, [loadAll]);


  // -------------------- QR SCANNER --------------------

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
              `Verified flat: ${result.flat.building ?? ""} ${result.flat.flat_number}
