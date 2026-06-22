export interface LineStation {
  id: number;
  name: string;
  nameRoman: string | null;
  latitude: number;
  longitude: number;
}

export interface LineMeta {
  id: number;
  name: string;
  nameRoman: string | null;
  color: string;
  stations: LineStation[];
}

const GQL_URL = process.env.TRAINLCD_GRAPHQL_URL ?? "https://gql-stg.trainlcd.app/";

const QUERY = `query L($lineId: Int!) {
  line(lineId: $lineId) {
    id
    nameShort
    nameRoman
    color
  }
  lineStations(lineId: $lineId) {
    id
    name
    nameRoman
    latitude
    longitude
  }
}`;

const cache = new Map<number, LineMeta>();
const inFlight = new Map<number, Promise<LineMeta | null>>();
const negativeCache = new Set<number>();

interface GqlLine {
  id: number;
  nameShort: string | null;
  nameRoman: string | null;
  color: string | null;
}

interface GqlStation {
  id: number;
  name: string | null;
  nameRoman: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface GqlResponse {
  data?: { line: GqlLine | null; lineStations: GqlStation[] | null };
  errors?: { message: string }[];
}

function normalizeStations(stations: GqlStation[] | null | undefined): LineStation[] {
  if (!stations) return [];
  const out: LineStation[] = [];
  for (const s of stations) {
    if (s.latitude == null || s.longitude == null) continue;
    out.push({
      id: s.id,
      name: s.name ?? `S${s.id}`,
      nameRoman: s.nameRoman ?? null,
      latitude: s.latitude,
      longitude: s.longitude,
    });
  }
  return out;
}

export function allCachedLines(): LineMeta[] {
  return Array.from(cache.values());
}

export async function resolveLine(lineId: number): Promise<LineMeta | null> {
  const cached = cache.get(lineId);
  if (cached) return cached;
  if (negativeCache.has(lineId)) return null;
  const pending = inFlight.get(lineId);
  if (pending) return pending;

  const p = (async (): Promise<LineMeta | null> => {
    try {
      const res = await fetch(GQL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: QUERY, variables: { lineId } }),
      });
      if (!res.ok) {
        console.warn(`[trainlcd] line ${lineId} HTTP ${res.status}`);
        negativeCache.add(lineId);
        return null;
      }
      const json = (await res.json()) as GqlResponse;
      if (json.errors?.length) {
        console.warn(`[trainlcd] line ${lineId} errors`, json.errors);
        negativeCache.add(lineId);
        return null;
      }
      const line = json.data?.line;
      if (!line) {
        negativeCache.add(lineId);
        return null;
      }
      const meta: LineMeta = {
        id: line.id,
        name: line.nameShort ?? line.nameRoman ?? `Line ${line.id}`,
        nameRoman: line.nameRoman ?? null,
        color: line.color && line.color.length > 0 ? line.color : "#6b7d9c",
        stations: normalizeStations(json.data?.lineStations),
      };
      cache.set(lineId, meta);
      return meta;
    } catch (e) {
      console.warn(`[trainlcd] line ${lineId} lookup failed`, e);
      return null;
    } finally {
      inFlight.delete(lineId);
    }
  })();

  inFlight.set(lineId, p);
  return p;
}
