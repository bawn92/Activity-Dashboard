import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useListActivities, type ActivitySummary } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import {
  formatAvgSpeedKmh,
  formatDate,
  formatDistance,
  formatDuration,
  formatPace,
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
import { ActivitySquare, ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

const ALL_SPORTS = "__all__";

type SortKey = "date" | "distance" | "avgHeartRate" | "avgSpeed";

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

export default function ActivitiesTablePage() {
  const { data: activities, isLoading } = useListActivities();

  const [sport, setSport] = useState<string>(ALL_SPORTS);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [paceMinSec, setPaceMinSec] = useState("");
  const [paceMaxSec, setPaceMaxSec] = useState("");
  const [distMinKm, setDistMinKm] = useState("");
  const [distMaxKm, setDistMaxKm] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

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

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
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
            <div className="mb-6 grid gap-4 rounded-xl border border-border bg-card p-4 shadow-card sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="filter-sport">Sport</Label>
                <Select value={sport} onValueChange={setSport}>
                  <SelectTrigger id="filter-sport" className="border-border bg-background">
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
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Date range</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="border-border bg-background"
                    aria-label="From date"
                  />
                  <span className="hidden text-muted-foreground sm:inline">–</span>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="border-border bg-background"
                    aria-label="To date"
                  />
                </div>
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label>Avg pace (sec/km)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    placeholder="Min"
                    value={paceMinSec}
                    onChange={(e) => setPaceMinSec(e.target.value)}
                    className="border-border bg-background"
                    aria-label="Minimum pace seconds per km"
                  />
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    placeholder="Max"
                    value={paceMaxSec}
                    onChange={(e) => setPaceMaxSec(e.target.value)}
                    className="border-border bg-background"
                    aria-label="Maximum pace seconds per km"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Matches stored pace; rows without pace are hidden when a bound is set.</p>
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label>Distance (km)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="Min km"
                    value={distMinKm}
                    onChange={(e) => setDistMinKm(e.target.value)}
                    className="border-border bg-background"
                  />
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="Max km"
                    value={distMaxKm}
                    onChange={(e) => setDistMaxKm(e.target.value)}
                    className="border-border bg-background"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Rows without distance are hidden when a bound is set.</p>
              </div>
            </div>

            <p className="label-mono text-muted-foreground mb-3">
              Showing {filteredSorted.length} of {activities.length}
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
                    <TableHead>Duration</TableHead>
                    <TableHead>Avg pace</TableHead>
                    <SortHeader
                      label="Avg speed"
                      active={sortKey === "avgSpeed"}
                      dir={sortDir}
                      onClick={() => handleSort("avgSpeed")}
                    />
                    <SortHeader
                      label="Avg HR"
                      active={sortKey === "avgHeartRate"}
                      dir={sortDir}
                      onClick={() => handleSort("avgHeartRate")}
                    />
                    <TableHead className="text-right w-[80px]"> </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSorted.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                        No activities match these filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSorted.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium capitalize">{a.sport || "—"}</TableCell>
                        <TableCell className="label-mono text-muted-foreground whitespace-nowrap">
                          {formatDate(a.startTime)}
                        </TableCell>
                        <TableCell className="label-mono">{formatDistance(a.distanceMeters)}</TableCell>
                        <TableCell className="label-mono">{formatDuration(a.durationSeconds)}</TableCell>
                        <TableCell className="label-mono">{formatPace(a.avgPaceSecPerKm)}</TableCell>
                        <TableCell className="label-mono">{formatAvgSpeedKmh(a.avgSpeedMps)}</TableCell>
                        <TableCell className="label-mono">
                          {a.avgHeartRate != null ? `${Math.round(a.avgHeartRate)} bpm` : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/activities/${a.id}`}>
                            <span className="text-sm text-primary hover:underline cursor-pointer">View</span>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
