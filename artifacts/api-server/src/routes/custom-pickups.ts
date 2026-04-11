import { Router, type IRouter } from "express";
import { db, bookingsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";

const router: IRouter = Router();

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const CLUSTER_RADIUS_METERS = 50;

interface Hotspot {
  coordinates: { lat: number; lng: number };
  totalUsage: number;
  studentsHistory: { name: string; date: string }[];
}

router.get(
  "/admin/custom-pickups-history",
  requireAuth,
  requireRole("admin"),
  async (_req, res): Promise<void> => {
    const rows = await db
      .select({
        lat: bookingsTable.customLat,
        lng: bookingsTable.customLng,
        createdAt: bookingsTable.createdAt,
        studentName: usersTable.name,
      })
      .from(bookingsTable)
      .innerJoin(usersTable, eq(bookingsTable.userId, usersTable.id))
      .where(eq(bookingsTable.pickupType, "custom"));

    const validRows = rows.filter(
      (r) =>
        r.lat !== null &&
        r.lat !== undefined &&
        r.lng !== null &&
        r.lng !== undefined,
    ) as { lat: number; lng: number; createdAt: Date; studentName: string }[];

    const hotspots: Hotspot[] = [];

    for (const row of validRows) {
      const dateStr = row.createdAt.toISOString().split("T")[0];
      const entry = { name: row.studentName, date: dateStr };

      let matched = false;
      for (const hotspot of hotspots) {
        const dist = haversineMeters(
          hotspot.coordinates.lat,
          hotspot.coordinates.lng,
          row.lat,
          row.lng,
        );
        if (dist <= CLUSTER_RADIUS_METERS) {
          const n = hotspot.totalUsage;
          hotspot.coordinates.lat =
            (hotspot.coordinates.lat * n + row.lat) / (n + 1);
          hotspot.coordinates.lng =
            (hotspot.coordinates.lng * n + row.lng) / (n + 1);
          hotspot.totalUsage += 1;
          hotspot.studentsHistory.push(entry);
          matched = true;
          break;
        }
      }

      if (!matched) {
        hotspots.push({
          coordinates: { lat: row.lat, lng: row.lng },
          totalUsage: 1,
          studentsHistory: [entry],
        });
      }
    }

    hotspots.sort((a, b) => b.totalUsage - a.totalUsage);

    res.json(hotspots);
  },
);

export default router;
