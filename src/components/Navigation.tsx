import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  Wifi,
  WifiOff,
  RefreshCw,
  Hash,
  ChevronDown,
  ChevronRight,
  Camera,
  ClipboardCheck,
  BarChart3,
  Users,
  ScrollText,
  Database,
  AlertTriangle,
} from "lucide-react";
import type { ElectionStore, TabKey, UserRole } from "@/types/election";
import { PERSONAS } from "@/constants/mockData";

const TABS: { key: TabKey; label: string; icon: typeof Camera; roles: UserRole[] }[] = [
  { key: "capture", label: "Capture", icon: Camera, roles: ["agent"] },
  { key: "review", label: "Review Queue", icon: ClipboardCheck, roles: ["reviewer"] },
  { key: "dashboard", label: "Command Center", icon: BarChart3, roles: ["agent", "coordinator", "reviewer", "observer", "admin", "auditor"] },
  { key: "party", label: "Party View", icon: Users, roles: ["coordinator"] },
  { key: "ledger", label: "Ledger & Audit", icon: ScrollText, roles: ["reviewer", "observer", "auditor"] },
  { key: "admin", label: "Admin Register", icon: Database, roles: ["admin", "auditor"] },
];

const ROLE_ACCENT: Record<UserRole, string> = {
  agent: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  coordinator: "text-cyan-400 border-cyan-500/40 bg-cyan-500/10",
  reviewer: "text-amber-400 border-amber-500/40 bg-amber-500/10",
  observer: "text-violet-400 border-violet-500/40 bg-violet-500/10",
  admin: "text-sky-400 border-sky-500/40 bg-sky-500/10",
  auditor: "text-rose-400 border-rose-500/40 bg-rose-500/10",
};

export default function Navigation({ store }: { store: ElectionStore }) {
  const [roleOpen, setRoleOpen] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(true);
  const pending = store.queue.filter((q) => q.syncStatus !== "synced").length;
  const visibleTabs = TABS.filter((t) => t.roles.includes(store.role));
  const accent = ROLE_ACCENT[store.role];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
      {/* Unofficial disclaimer bar */}
      <AnimatePresence initial={false}>
        {bannerOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-amber-500/30 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-rose-500/15"
          >
            <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-1.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
              <p className="flex-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300/90">
                Unofficial source-of-truth data — for audit &amp; reconciliation only. Not a declaration of results.
              </p>
              <button
                onClick={() => setBannerOpen(false)}
                className="rounded px-2 py-0.5 text-[10px] font-medium text-amber-300/70 hover:bg-amber-500/10 hover:text-amber-200"
              >
                Collapse
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {!bannerOpen && (
        <button
          onClick={() => setBannerOpen(true)}
          className="mx-auto flex w-full items-center justify-center gap-2 border-b border-amber-500/20 bg-amber-500/5 py-1 text-[10px] font-semibold uppercase tracking-widest text-amber-400/80 hover:bg-amber-500/10"
        >
          <AlertTriangle className="h-3 w-3" /> Unofficial data notice (hidden)
        </button>
      )}

      <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-2.5">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="relative grid h-9 w-9 place-items-center rounded-lg border border-emerald-500/40 bg-emerald-500/10">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_2px] shadow-emerald-500/60" />
          </div>
          <div className="hidden leading-tight sm:block">
            <p className="text-sm font-bold tracking-tight text-slate-100">EC8A Verify</p>
            <p className="font-mono text-[10px] text-slate-500">LEDGER HEIGHT {store.ledger.length.toString().padStart(4, "0")}</p>
          </div>
        </div>

        {/* Role switcher */}
        <div className="relative">
          <button
            onClick={() => setRoleOpen((v) => !v)}
            className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${accent}`}
          >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-200">
              {store.persona.initials}
            </span>
            <span className="hidden text-left md:block">
              <span className="block leading-tight">{store.persona.name}</span>
              <span className="block font-mono text-[9px] uppercase tracking-wide opacity-70">{store.persona.title}</span>
            </span>
            <ChevronDown className="h-4 w-4 opacity-70" />
          </button>
          <AnimatePresence>
            {roleOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/95 shadow-2xl shadow-black/50 backdrop-blur"
              >
                <p className="border-b border-slate-800 px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  Switch demo persona
                </p>
                {PERSONAS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      store.setRole(p.role);
                      setRoleOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-800/70 ${
                      p.role === store.role ? "bg-slate-800/50" : ""
                    }`}
                  >
                    <span className={`grid h-8 w-8 place-items-center rounded-full border text-[11px] font-bold ${ROLE_ACCENT[p.role]}`}>
                      {p.initials}
                    </span>
                    <span className="flex-1">
                      <span className="block text-xs font-semibold text-slate-100">{p.name}</span>
                      <span className="block text-[10px] text-slate-500">{p.title}</span>
                    </span>
                    {p.role === store.role && <ChevronRight className="h-4 w-4 text-emerald-400" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex-1" />

        {/* Queue + sync */}
        <button
          onClick={store.syncAll}
          disabled={!store.online || pending === 0}
          className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
            pending > 0 && store.online
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
              : "border-slate-800 bg-slate-900 text-slate-500"
          }`}
        >
          <RefreshCw className={`h-4 w-4 ${pending > 0 && store.online ? "animate-spin" : ""}`} style={{ animationDuration: "1.4s" }} />
          <span className="hidden sm:inline">Sync All</span>
          <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1 font-mono text-[10px] ${pending > 0 ? "bg-amber-500/20 text-amber-300" : "bg-slate-800 text-slate-500"}`}>
            {pending}
          </span>
        </button>

        {/* Ledger height */}
        <div className="hidden items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-2.5 py-1.5 text-xs font-semibold text-cyan-300 lg:flex">
          <Hash className="h-4 w-4" />
          <span className="font-mono">{store.ledger.length}</span>
        </div>

        {/* Network toggle */}
        <button
          onClick={store.toggleOnline}
          className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
            store.online
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-rose-500/40 bg-rose-500/10 text-rose-300"
          }`}
        >
          {store.online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
          <span className="hidden md:inline">{store.online ? "Live Online" : "Offline Field Mode"}</span>
        </button>
      </div>

      {/* Tabs */}
      <nav className="mx-auto flex max-w-[1600px] gap-1 overflow-x-auto px-3 pb-2">
        {visibleTabs.map((t) => {
          const Icon = t.icon;
          const active = store.activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => store.setActiveTab(t.key)}
              className={`relative flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                active ? "text-slate-900" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-0 rounded-lg bg-gradient-to-r from-emerald-400 to-cyan-400"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <Icon className="relative z-10 h-4 w-4" />
              <span className="relative z-10">{t.label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
}
