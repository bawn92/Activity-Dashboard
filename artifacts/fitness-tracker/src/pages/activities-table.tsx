import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { useListActivities, useDeleteActivity, getListActivitiesQueryKey, type ActivitySummary } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/layout";
import {
  formatDate,
  formatDistance,
  formatDuration,
  formatSpeedForSport,
} from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ActivitySquare, ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, Trash2, X } from "lucide-react";
import { useAllowedStatus } from "@/hooks/use-allowed-status";

const ALL_SPORTS = "__all__";

type SortKey = "date" | "distance" | "avgHeartRate" | "avgSpeed" | "duration" | "paceSpeed";

function startOfLocalDayMs(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return NaN;
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

function endOfLocalDayMs(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return NaN;
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

function parseOptionalPositiveFloat(raw: string): number | undefined {
  const t = raw.trim();
  if (t === "") return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

function parseOptionalPositiveInt(raw: string): number | undefined {
  const t = raw.trim();
  if (t === "") return undefined;
  const n = Number.parseInt(t, 10);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

function compareNullableNumber(
  a: number | null | undefined,
  b: number | null | undefined,
  dir: "asc" | "desc",
): number {
  const na = a == null;
  const nb = b == null;
  if (na && nb) return 0;
  if (na) return 1;
  if (nb) return -1;
  const cmp = a - b;
  return dir === "asc" ? cmp : -cmp;
}

function activityMs(a: ActivitySummary): number {
  return new Date(a.startTime).getTime();
}

/**
 * Returns a sort value for the Pace / Speed column that matches the displayed
 * numeric value so ascending sort means "smallest displayed number first":
 *   - pace sports (run/hike/walk): sec/km  (lower = faster pace)
 *   - swim:                        sec/100m (lower = faster pace)
 *   - speed sports (cycling, etc): km/h    (lower = slower speed)
 * Returns null when no speed is available.
 */
function paceSpeedSortValue(sport: string | null | undefined, mps: number | null | undefined): number | null {
  if (mps == null || mps <= 0) return null;
  const s = (sport ?? "").toLowerCase().replace(/[_\s-]/g, "");
  if (s.includes("swim")) return 100 / mps;
  if (s.includes("run") || s.includes("hik") || s.includes("walk")) return 1000 / mps;
  return mps * 3.6;
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <TableHead className="whitespace-nowrap">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {label}
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}

const PAGE_SIZE = 250;

export default function ActivitiesTablePage() {
  const [page, setPage] = useState(0);
  const tableTopRef = useRef<HTMLDivElement>(null);
  const { data: activitiesPage, isLoading } = useListActivities({ limit: PAGE_SIZE, offset: page * PAGE_SIZE });
  const activities = activitiesPage?.data ?? undefined;
  const total = activitiesPage?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteMutation = useDeleteActivity();
  const allowedStatus = useAllowedStatus();
  const canEdit = allowedStatus.state === "allowed";

  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const handleDeleteConfirm = () => {
    if (pendingDeleteId == null) return;
    deleteMutation.mutate({ id: pendingDeleteId }, {
      onSuccess: () => {
        toast({ title: "Activity deleted", description: "The activity has been removed." });
        queryClient.invalidateQueries({ queryKey: getListActivitiesQueryKey() });
        setPendingDeleteId(null);
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to delete activity.", variant: "destructive" });
        setPendingDeleteId(null);
      },
    });
  };

  const [sport, setSport] = useState<string>(ALL_SPORTS);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [paceMinSec, setPaceMinSec] = useState("");
  const [paceMaxSec, setPaceMaxSec] = useState("");
  const [distMinKm, setDistMinKm] = useState("");
  const [distMaxKm, setDistMaxKm] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const resetPage = () => setPage(0);

  useEffect(() => {
    tableTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [page]);

  const sports = useMemo(() => {
    if (!activities?.length) return [];
    const set = new Set<string>();
    for (const a of activities) {
      const s = (a.sport || "").trim();
      if (s) set.add(s);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [activities]);

  const paceMinBound = parseOptionalPositiveInt(paceMinSec);
  const paceMaxBound = parseOptionalPositiveInt(paceMaxSec);
  const distMinKmParsed = parseOptionalPositiveFloat(distMinKm);
  const distMaxKmParsed = parseOptionalPositiveFloat(distMaxKm);
  const distMinM = distMinKmParsed != null ? distMinKmParsed * 1000 : undefined;
  const distMaxM = distMaxKmParsed != null ? distMaxKmParsed * 1000 : undefined;
  const hasPaceFilter = paceMinBound != null || paceMaxBound != null;
  const hasDistFilter = distMinM != null || distMaxM != null;

  const filteredSorted = useMemo(() => {
    if (!activities?.length) return [];

    let rows = [...activities];

    if (sport !== ALL_SPORTS) {
      rows = rows.filter((a) => (a.sport || "").trim() === sport);
    }

    if (dateFrom.trim()) {
      const fromMs = startOfLocalDayMs(dateFrom.trim());
      if (!Number.isNaN(fromMs)) {
        rows = rows.filter((a) => activityMs(a) >= fromMs);
      }
    }
    if (dateTo.trim()) {
      const toMs = endOfLocalDayMs(dateTo.trim());
      if (!Number.isNaN(toMs)) {
        rows = rows.filter((a) => activityMs(a) <= toMs);
      }
    }

    if (hasPaceFilter) {
      rows = rows.filter((a) => {
        const p = a.avgPaceSecPerKm;
        if (p == null) return false;
        if (paceMinBound != null && p < paceMinBound) return false;
        if (paceMaxBound != null && p > paceMaxBound) return false;
        return true;
      });
    }

    if (hasDistFilter) {
      rows = rows.filter((a) => {
        const d = a.distanceMeters;
        if (d == null) return false;
        if (distMinM != null && d < distMinM) return false;
        if (distMaxM != null && d > distMaxM) return false;
        return true;
      });
    }

    rows.sort((a, b) => {
      if (sortKey === "date") {
        const cmp = activityMs(a) - activityMs(b);
        return sortDir === "asc" ? cmp : -cmp;
      }
      if (sortKey === "distance") {
        return compareNullableNumber(a.distanceMeters, b.distanceMeters, sortDir);
      }
      if (sortKey === "avgHeartRate") {
        return compareNullableNumber(a.avgHeartRate, b.avgHeartRate, sortDir);
      }
      if (sortKey === "duration") {
        return compareNullableNumber(a.durationSeconds, b.durationSeconds, sortDir);
      }
      if (sortKey === "paceSpeed") {
        return compareNullableNumber(paceSpeedSortValue(a.sport, a.avgSpeedMps), paceSpeedSortValue(b.sport, b.avgSpeedMps), sortDir);
      }
      return compareNullableNumber(a.avgSpeedMps, b.avgSpeedMps, sortDir);
    });

    return rows;
  }, [
    activities,
    sport,
    dateFrom,
    dateTo,
    paceMinBound,
    paceMaxBound,
    hasPaceFilter,
    distMinM,
    distMaxM,
    hasDistFilter,
    sortKey,
    sortDir,
  ]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "asc");
    }
  };

  const handleSetSport = (v: string) => { setSport(v); resetPage(); };
  const handleSetDateFrom = (v: string) => { setDateFrom(v); resetPage(); };
  const handleSetDateTo = (v: string) => { setDateTo(v); resetPage(); };
  const handleSetPaceMinSec = (v: string) => { setPaceMinSec(v); resetPage(); };
  const handleSetPaceMaxSec = (v: string) => { setPaceMaxSec(v); resetPage(); };
  const handleSetDistMinKm = (v: string) => { setDistMinKm(v); resetPage(); };
  const handleSetDistMaxKm = (v: string) => { setDistMaxKm(v); resetPage(); };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div ref={tableTopRef} className="scroll-mt-4" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <h1 className="text-2xl font-medium tracking-tight" data-testid="page-title-table">
            Activity table
          </h1>
          <div className="flex flex-wrap gap-2">
            <Link href="/activities">
              <Button variant="outline" className="border-border" data-testid="link-activities-list">
                List view
              </Button>
            </Link>
            <Link href="/">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90" data-testid="button-upload">
                Upload
              </Button>
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full rounded-lg bg-border" />
            <Skeleton className="h-64 w-full rounded-lg bg-border" />
          </div>
        ) : !activities || activities.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-lg bg-card/30">
            <ActivitySquare className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-20" />
            <h3 className="text-lg font-medium text-foreground mb-1">No activities yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Upload a .fit file to see your data.</p>
            <Link href="/">
              <span className="text-sm text-primary hover:underline cursor-pointer">Go to upload</span>
            </Link>
          </div>
        ) : (
          <>
            {(() => {
              const sportActive = sport !== ALL_SPORTS;
              const dateActive = dateFrom.trim() !== "" || dateTo.trim() !== "";
              const paceActive = paceMinSec.trim() !== "" || paceMaxSec.trim() !== "";
              const distActive = distMinKm.trim() !== "" || distMaxKm.trim() !== "";
              const anyActive = sportActive || dateActive || paceActive || distActive;

              function formatShortDate(d: string) {
                if (!d) return "";
                const [y, m, day] = d.split("-");
                if (!y || !m || !day) return d;
                const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
                return `${months[Number(m) - 1]} ${Number(day)}`;
              }

              const sportLabel = sportActive ? `Sport: ${sport}` : "Sport";
              const dateLabel = dateActive
                ? dateFrom && dateTo
                  ? `Date: ${formatShortDate(dateFrom)} – ${formatShortDate(dateTo)}`
                  : dateFrom
                  ? `Date: from ${formatShortDate(dateFrom)}`
                  : `Date: to ${formatShortDate(dateTo)}`
                : "Date";
              const paceLabel = paceActive
                ? paceMinSec && paceMaxSec
                  ? `Pace: ${paceMinSec}–${paceMaxSec} s/km`
                  : paceMinSec
                  ? `Pace: ≥${paceMinSec} s/km`
                  : `Pace: ≤${paceMaxSec} s/km`
                : "Pace";
              const distLabel = distActive
                ? distMinKm && distMaxKm
                  ? `Distance: ${distMinKm}–${distMaxKm} km`
                  : distMinKm
                  ? `Distance: ≥${distMinKm} km`
                  : `Distance: ≤${distMaxKm} km`
                : "Distance";

              const pillBase = "inline-flex items-center overflow-hidden rounded-full border text-xs font-medium transition-colors";
              const activePill = "border-primary bg-primary/10 text-primary";
              const inactivePill = "border-border text-muted-foreground";
              const triggerBtn = "flex items-center gap-1.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
              const clearBtn = "flex items-center py-1.5 pr-2 pl-1 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

              return (
                <div className="mb-6 flex flex-wrap items-center gap-2">
                  <Popover>
                    <div data-testid="filter-sport" className={`${pillBase} ${sportActive ? activePill : inactivePill}`}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={`${triggerBtn} pl-3 ${sportActive ? "pr-2 hover:bg-primary/20" : "pr-3 hover:text-foreground"}`}
                          aria-label={sportActive ? `Sport filter: ${sport}. Click to change` : "Sport filter"}
                        >
                          {sportLabel}
                          {!sportActive && <ChevronDown className="h-3 w-3 opacity-60" />}
                        </button>
                      </PopoverTrigger>
                      {sportActive && (
                        <>
                          <div className="w-px self-stretch bg-primary/30" aria-hidden />
                          <button
                            type="button"
                            aria-label="Clear sport filter"
                            className={`${clearBtn} hover:bg-primary/20`}
                            onClick={() => handleSetSport(ALL_SPORTS)}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                    <PopoverContent align="start" className="w-56 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="filter-sport-select" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sport</Label>
                        {sportActive && (
                          <button type="button" onClick={() => handleSetSport(ALL_SPORTS)} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
                        )}
                      </div>
                      <Select value={sport} onValueChange={handleSetSport}>
                        <SelectTrigger id="filter-sport-select" className="border-border bg-background">
                          <SelectValue placeholder="Sport" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL_SPORTS}>All sports</SelectItem>
                          {sports.map((s) => (
                            <SelectItem key={s} value={s} className="capitalize">
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <div data-testid="filter-date" className={`${pillBase} ${dateActive ? activePill : inactivePill}`}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={`${triggerBtn} pl-3 ${dateActive ? "pr-2 hover:bg-primary/20" : "pr-3 hover:text-foreground"}`}
                          aria-label={dateActive ? `Date filter: ${dateLabel}. Click to change` : "Date range filter"}
                        >
                          {dateLabel}
                          {!dateActive && <ChevronDown className="h-3 w-3 opacity-60" />}
                        </button>
                      </PopoverTrigger>
                      {dateActive && (
                        <>
                          <div className="w-px self-stretch bg-primary/30" aria-hidden />
                          <button
                            type="button"
                            aria-label="Clear date filter"
                            className={`${clearBtn} hover:bg-primary/20`}
                            onClick={() => { handleSetDateFrom(""); handleSetDateTo(""); }}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                    <PopoverContent align="start" className="w-72 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date range</Label>
                        {dateActive && (
                          <button type="button" onClick={() => { handleSetDateFrom(""); handleSetDateTo(""); }} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <Input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => handleSetDateFrom(e.target.value)}
                          className="border-border bg-background"
                          aria-label="From date"
                        />
                        <span className="text-xs text-center text-muted-foreground">–</span>
                        <Input
                          type="date"
                          value={dateTo}
                          onChange={(e) => handleSetDateTo(e.target.value)}
                          className="border-border bg-background"
                          aria-label="To date"
                        />
                      </div>
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <div data-testid="filter-pace" className={`${pillBase} ${paceActive ? activePill : inactivePill}`}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={`${triggerBtn} pl-3 ${paceActive ? "pr-2 hover:bg-primary/20" : "pr-3 hover:text-foreground"}`}
                          aria-label={paceActive ? `Pace filter: ${paceLabel}. Click to change` : "Avg pace filter"}
                        >
                          {paceLabel}
                          {!paceActive && <ChevronDown className="h-3 w-3 opacity-60" />}
                        </button>
                      </PopoverTrigger>
                      {paceActive && (
                        <>
                          <div className="w-px self-stretch bg-primary/30" aria-hidden />
                          <button
                            type="button"
                            aria-label="Clear pace filter"
                            className={`${clearBtn} hover:bg-primary/20`}
                            onClick={() => { handleSetPaceMinSec(""); handleSetPaceMaxSec(""); }}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                    <PopoverContent align="start" className="w-64 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Avg pace (sec/km)</Label>
                        {paceActive && (
                          <button type="button" onClick={() => { handleSetPaceMinSec(""); handleSetPaceMaxSec(""); }} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          placeholder="Min"
                          value={paceMinSec}
                          onChange={(e) => handleSetPaceMinSec(e.target.value)}
                          className="border-border bg-background"
                          aria-label="Minimum pace seconds per km"
                        />
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          placeholder="Max"
                          value={paceMaxSec}
                          onChange={(e) => handleSetPaceMaxSec(e.target.value)}
                          className="border-border bg-background"
                          aria-label="Maximum pace seconds per km"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Matches stored pace; rows without pace are hidden when a bound is set.</p>
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <div data-testid="filter-distance" className={`${pillBase} ${distActive ? activePill : inactivePill}`}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={`${triggerBtn} pl-3 ${distActive ? "pr-2 hover:bg-primary/20" : "pr-3 hover:text-foreground"}`}
                          aria-label={distActive ? `Distance filter: ${distLabel}. Click to change` : "Distance filter"}
                        >
                          {distLabel}
                          {!distActive && <ChevronDown className="h-3 w-3 opacity-60" />}
                        </button>
                      </PopoverTrigger>
                      {distActive && (
                        <>
                          <div className="w-px self-stretch bg-primary/30" aria-hidden />
                          <button
                            type="button"
                            aria-label="Clear distance filter"
                            className={`${clearBtn} hover:bg-primary/20`}
                            onClick={() => { handleSetDistMinKm(""); handleSetDistMaxKm(""); }}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                    <PopoverContent align="start" className="w-64 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Distance (km)</Label>
                        {distActive && (
                          <button type="button" onClick={() => { handleSetDistMinKm(""); handleSetDistMaxKm(""); }} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="Min km"
                          value={distMinKm}
                          onChange={(e) => handleSetDistMinKm(e.target.value)}
                          className="border-border bg-background"
                        />
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="Max km"
                          value={distMaxKm}
                          onChange={(e) => handleSetDistMaxKm(e.target.value)}
                          className="border-border bg-background"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Rows without distance are hidden when a bound is set.</p>
                    </PopoverContent>
                  </Popover>

                  {anyActive && (
                    <button
                      type="button"
                      data-testid="filters-clear-all"
                      onClick={() => {
                        handleSetSport(ALL_SPORTS);
                        handleSetDateFrom("");
                        handleSetDateTo("");
                        handleSetPaceMinSec("");
                        handleSetPaceMaxSec("");
                        handleSetDistMinKm("");
                        handleSetDistMaxKm("");
                      }}
                      className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-3 w-3" />
                      Clear all
                    </button>
                  )}
                </div>
              );
            })()}

            <p className="label-mono text-muted-foreground mb-3">
              Showing {filteredSorted.length} of {activities.length} on this page
            </p>

            <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
              <Table data-testid="activities-data-table">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[100px]">Sport</TableHead>
                    <SortHeader
                      label="Date"
                      active={sortKey === "date"}
                      dir={sortDir}
                      onClick={() => handleSort("date")}
                    />
                    <SortHeader
                      label="Distance"
                      active={sortKey === "distance"}
                      dir={sortDir}
                      onClick={() => handleSort("distance")}
                    />
                    <SortHeader
                      label="Duration"
                      active={sortKey === "duration"}
                      dir={sortDir}
                      onClick={() => handleSort("duration")}
                    />
                    <SortHeader
                      label="Pace / Speed"
                      active={sortKey === "paceSpeed"}
                      dir={sortDir}
                      onClick={() => handleSort("paceSpeed")}
                    />
                    <SortHeader
                      label="Avg HR"
                      active={sortKey === "avgHeartRate"}
                      dir={sortDir}
                      onClick={() => handleSort("avgHeartRate")}
                    />
                    {canEdit && <TableHead className="text-right w-[40px]"> </TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSorted.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                        No activities match these filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSorted.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium capitalize">{a.sport || "—"}</TableCell>
                        <TableCell className="label-mono whitespace-nowrap">
                          <Link href={`/activities/${a.id}`} className="text-primary hover:underline cursor-pointer">
                            {formatDate(a.startTime)}
                          </Link>
                        </TableCell>
                        <TableCell className="label-mono">{formatDistance(a.distanceMeters)}</TableCell>
                        <TableCell className="label-mono">{formatDuration(a.durationSeconds)}</TableCell>
                        <TableCell className="label-mono">{formatSpeedForSport(a.sport, a.avgSpeedMps).formatted}</TableCell>
                        <TableCell className="label-mono">
                          {a.avgHeartRate != null ? `${Math.round(a.avgHeartRate)} bpm` : "—"}
                        </TableCell>
                        {canEdit && (
                          <TableCell className="text-right">
                            <button
                              type="button"
                              aria-label={`Delete ${a.sport || "activity"} on ${formatDate(a.startTime)}`}
                              onClick={() => setPendingDeleteId(a.id)}
                              className="text-muted-foreground/40 hover:text-destructive transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 label-mono text-sm text-muted-foreground">
                <Button
                  variant="outline"
                  className="border-border"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  data-testid="pagination-prev"
                >
                  Previous
                </Button>
                <span data-testid="pagination-info">
                  Page {page + 1} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  className="border-border"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  data-testid="pagination-next"
                >
                  Next
                </Button>
              </div>
            )}

            <AlertDialog
              open={pendingDeleteId != null}
              onOpenChange={(open) => { if (!open && !deleteMutation.isPending) setPendingDeleteId(null); }}
            >
              <AlertDialogContent className="bg-popover border-border">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Activity?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete this activity and all associated data.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleteMutation.isPending} className="border-border hover:bg-card">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteConfirm}
                    disabled={deleteMutation.isPending}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60"
                  >
                    {deleteMutation.isPending ? "Deleting…" : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
    </Layout>
  );
}
