import { nanoid } from 'nanoid';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import type { NewProjectInput, ProjectRecord } from '../lib/db/types';
import { STYLE_TAGS } from '../lib/catalog';
import { ZONE_TYPES } from '../lib/zones';
import {
  LAYOUT_V2_FLOOR_MATERIALS,
  LAYOUT_V2_OPENING_TYPES,
  LAYOUT_V2_TERRAIN_MATERIALS,
  LAYOUT_V2_WALL_MATERIALS,
} from '../lib/layout-v2/types';
import { serverAuthMiddleware } from './auth-middleware';

type QueryArgs = Record<string, unknown>;

export interface ProjectRow {
  id: string;
  userId: string | null;
  name: string;
  templateId: string | null;
  climateZone: string;
  budgetTier: ProjectRecord['budgetTier'];
  contingencyPct: number;
  taxEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  data: unknown;
}

interface ProjectModel {
  findMany(args: QueryArgs): Promise<ProjectRow[]>;
  findFirst(args: QueryArgs): Promise<ProjectRow | null>;
  create(args: QueryArgs): Promise<ProjectRow>;
  update(args: QueryArgs): Promise<ProjectRow>;
  delete(args: QueryArgs): Promise<ProjectRow>;
}

export interface ProjectDb {
  project: ProjectModel;
}

export interface ProjectService {
  listProjects(userId: string): Promise<ProjectRecord[]>;
  createProject(userId: string, input: NewProjectInput): Promise<ProjectRecord>;
  importProject(userId: string, record: ProjectRecord): Promise<ProjectRecord | null>;
  getProject(userId: string, id: string): Promise<ProjectRecord | null>;
  saveProject(userId: string, record: ProjectRecord): Promise<ProjectRecord | null>;
  deleteProject(userId: string, id: string): Promise<boolean>;
  generateShareToken(
    userId: string,
    projectId: string,
  ): Promise<{ token: string; expiry: number } | null>;
  getSharedProject(projectId: string, token: string): Promise<ProjectRecord | null>;
}

interface ServiceOptions {
  now?: () => Date;
  id?: () => string;
  token?: () => string;
}

const SHARE_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const projectInputSchema = z.object({
  name: z.string(),
  templateId: z.string().nullable(),
  budgetTier: z.enum(['hemat', 'standar', 'premium', 'mewah']),
  contingencyPct: z.number(),
  taxEnabled: z.boolean(),
  climateZone: z.string(),
});

const placedItemSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  zoneId: z.string(),
  quantity: z.number(),
  notes: z.string(),
  position3d: z.tuple([z.number(), z.number(), z.number()]).optional(),
});

const zoneSchema = z.object({
  id: z.string(),
  type: z.enum(ZONE_TYPES),
  name: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

const layoutPointSchema = z.object({ x: z.number(), y: z.number() });

const layoutV2Schema = z.object({
  version: z.literal(2),
  activeFloorId: z.string(),
  floors: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      level: z.number(),
      elevationM: z.number(),
    }),
  ),
  areas: z.array(
    z.object({
      id: z.string(),
      zoneId: z.string(),
      floorId: z.string(),
      name: z.string(),
      zoneType: z.enum(ZONE_TYPES),
      kind: z.enum(['indoor', 'outdoor']),
      points: z.array(layoutPointSchema).min(3),
      floorMaterial: z.enum(LAYOUT_V2_FLOOR_MATERIALS),
      wallMaterial: z.enum(LAYOUT_V2_WALL_MATERIALS),
      terrainMaterial: z.enum(LAYOUT_V2_TERRAIN_MATERIALS).optional(),
    }),
  ),
  walls: z.array(
    z.object({
      id: z.string(),
      areaId: z.string(),
      floorId: z.string(),
      start: layoutPointSchema,
      end: layoutPointSchema,
      heightM: z.number(),
      thicknessM: z.number(),
      material: z.enum(LAYOUT_V2_WALL_MATERIALS),
      exterior: z.boolean(),
    }),
  ),
  openings: z.array(
    z.object({
      id: z.string(),
      wallId: z.string(),
      type: z.enum(LAYOUT_V2_OPENING_TYPES),
      offsetM: z.number(),
      widthM: z.number(),
      heightM: z.number(),
      sillHeightM: z.number(),
    }),
  ),
});

const projectRecordSchema = projectInputSchema.extend({
  id: z.string(),
  styleTag: z.enum(STYLE_TAGS).nullable(),
  floorPlanImageUrl: z.string().nullable().optional(),
  shareToken: z.string().nullable().optional(),
  shareTokenExpiry: z.number().nullable().optional(),
  layoutV2: layoutV2Schema.nullable().optional(),
  zones: z.array(zoneSchema),
  placedItems: z.array(placedItemSchema),
  createdAt: z.number(),
  updatedAt: z.number(),
});

type ParsedProjectRecord = z.infer<typeof projectRecordSchema>;

function normalizeProjectRecord(record: ParsedProjectRecord): ProjectRecord {
  return {
    id: record.id,
    name: record.name,
    templateId: record.templateId,
    budgetTier: record.budgetTier,
    contingencyPct: record.contingencyPct,
    taxEnabled: record.taxEnabled,
    climateZone: record.climateZone,
    styleTag: record.styleTag,
    floorPlanImageUrl: record.floorPlanImageUrl ?? null,
    shareToken: record.shareToken ?? null,
    shareTokenExpiry: record.shareTokenExpiry ?? null,
    layoutV2: (record.layoutV2 as ProjectRecord['layoutV2']) ?? null,
    zones: record.zones,
    placedItems: record.placedItems.map((item) => ({
      id: item.id,
      itemId: item.itemId,
      zoneId: item.zoneId,
      quantity: item.quantity,
      notes: item.notes,
      ...(item.position3d ? { position3d: item.position3d } : {}),
    })),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toStoredRecord(record: ProjectRecord, updatedAt: number): ProjectRecord {
  return {
    ...record,
    floorPlanImageUrl: record.floorPlanImageUrl ?? null,
    shareToken: record.shareToken ?? null,
    shareTokenExpiry: record.shareTokenExpiry ?? null,
    placedItems: record.placedItems ?? [],
    updatedAt,
  };
}

function recordFromRow(row: ProjectRow): ProjectRecord {
  const parsed = projectRecordSchema.safeParse(row.data);
  if (parsed.success) {
    return toStoredRecord(normalizeProjectRecord(parsed.data), row.updatedAt.getTime());
  }

  return {
    id: row.id,
    name: row.name,
    templateId: row.templateId,
    budgetTier: row.budgetTier,
    contingencyPct: row.contingencyPct,
    taxEnabled: row.taxEnabled,
    climateZone: row.climateZone,
    styleTag: null,
    floorPlanImageUrl: null,
    shareToken: null,
    shareTokenExpiry: null,
    layoutV2: null,
    zones: [],
    placedItems: [],
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

function toProjectColumns(record: ProjectRecord) {
  return {
    name: record.name,
    templateId: record.templateId,
    budgetTier: record.budgetTier,
    contingencyPct: record.contingencyPct,
    taxEnabled: record.taxEnabled,
    climateZone: record.climateZone,
    data: record,
  };
}

export function createProjectService(
  db: ProjectDb,
  options: ServiceOptions = {},
): ProjectService {
  const getNow = options.now ?? (() => new Date());
  const createId = options.id ?? (() => nanoid(8));
  const createToken = options.token ?? (() => nanoid(16));

  return {
    async listProjects(userId) {
      const rows = await db.project.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      });
      return rows.map(recordFromRow);
    },

    async createProject(userId, input) {
      const now = getNow();
      const record: ProjectRecord = {
        id: createId(),
        ...projectInputSchema.parse(input),
        styleTag: null,
        floorPlanImageUrl: null,
        shareToken: null,
        shareTokenExpiry: null,
        zones: [],
        placedItems: [],
        createdAt: now.getTime(),
        updatedAt: now.getTime(),
      };

      const row = await db.project.create({
        data: {
          id: record.id,
          userId,
          currency: 'IDR',
          ...toProjectColumns(record),
        },
      });
      return recordFromRow(row);
    },

    async importProject(userId, record) {
      const existing = await db.project.findFirst({
        where: { id: record.id, userId },
      });
      if (existing) return recordFromRow(existing);

      const updated = toStoredRecord(
        normalizeProjectRecord(projectRecordSchema.parse(record)),
        getNow().getTime(),
      );
      const row = await db.project.create({
        data: {
          id: updated.id,
          userId,
          currency: 'IDR',
          ...toProjectColumns(updated),
        },
      });
      return recordFromRow(row);
    },

    async getProject(userId, id) {
      const row = await db.project.findFirst({ where: { id, userId } });
      return row ? recordFromRow(row) : null;
    },

    async saveProject(userId, record) {
      const existing = await db.project.findFirst({
        where: { id: record.id, userId },
      });
      if (!existing) return null;

      const updated = toStoredRecord(
        normalizeProjectRecord(projectRecordSchema.parse(record)),
        getNow().getTime(),
      );
      const row = await db.project.update({
        where: { id: record.id },
        data: toProjectColumns(updated),
      });
      return recordFromRow(row);
    },

    async deleteProject(userId, id) {
      const existing = await db.project.findFirst({ where: { id, userId } });
      if (!existing) return false;
      await db.project.delete({ where: { id } });
      return true;
    },

    async generateShareToken(userId, projectId) {
      const row = await db.project.findFirst({
        where: { id: projectId, userId },
      });
      if (!row) return null;

      const token = createToken();
      const expiry = getNow().getTime() + SHARE_TOKEN_TTL_MS;
      const record = {
        ...recordFromRow(row),
        shareToken: token,
        shareTokenExpiry: expiry,
      };

      await db.project.update({
        where: { id: projectId },
        data: toProjectColumns(record),
      });

      return { token, expiry };
    },

    async getSharedProject(projectId, token) {
      const row = await db.project.findFirst({ where: { id: projectId } });
      if (!row) return null;
      const record = recordFromRow(row);
      if (!record.shareToken || record.shareToken !== token) return null;
      if (!record.shareTokenExpiry || getNow().getTime() >= record.shareTokenExpiry) {
        return null;
      }
      return record;
    },
  };
}

export function requireUserId(session: import('@supabase/supabase-js').Session | null): string {
  if (!session) throw new Error('Authentication required.');
  return session.user.id;
}

async function getProjectService(): Promise<ProjectService> {
  const service = await import('./projects-service.server');
  return service.getProjectService();
}

export const listOwnedProjectsFn = createServerFn({ method: 'GET' })
  .middleware([serverAuthMiddleware])
  .handler(async ({ context }) => {
    const service = await getProjectService();
    return service.listProjects(requireUserId(context.session));
  });

export const createOwnedProjectFn = createServerFn({ method: 'POST' })
  .middleware([serverAuthMiddleware])
  .inputValidator(projectInputSchema)
  .handler(async ({ context, data }) => {
    const userId = requireUserId(context.session);
    const { ensureUser } = await import('./users');
    await ensureUser({
      id: userId,
      ...(context.session?.user.email ? { email: context.session.user.email } : {}),
    });
    const service = await getProjectService();
    return service.createProject(userId, data);
  });

export const getOwnedProjectFn = createServerFn({ method: 'GET' })
  .middleware([serverAuthMiddleware])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ context, data }) => {
    const service = await getProjectService();
    return service.getProject(requireUserId(context.session), data.id);
  });

export const saveOwnedProjectFn = createServerFn({ method: 'POST' })
  .middleware([serverAuthMiddleware])
  .inputValidator(projectRecordSchema)
  .handler(async ({ context, data }) => {
    const service = await getProjectService();
    return service.saveProject(
      requireUserId(context.session),
      normalizeProjectRecord(data),
    );
  });

export const importOwnedProjectFn = createServerFn({ method: 'POST' })
  .middleware([serverAuthMiddleware])
  .inputValidator(projectRecordSchema)
  .handler(async ({ context, data }) => {
    const userId = requireUserId(context.session);
    const { ensureUser } = await import('./users');
    await ensureUser({
      id: userId,
      ...(context.session?.user.email ? { email: context.session.user.email } : {}),
    });
    const service = await getProjectService();
    return service.importProject(userId, normalizeProjectRecord(data));
  });

export const deleteOwnedProjectFn = createServerFn({ method: 'POST' })
  .middleware([serverAuthMiddleware])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ context, data }) => {
    const service = await getProjectService();
    return { deleted: await service.deleteProject(requireUserId(context.session), data.id) };
  });

export const generateOwnedShareTokenFn = createServerFn({ method: 'POST' })
  .middleware([serverAuthMiddleware])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ context, data }) => {
    const service = await getProjectService();
    return service.generateShareToken(requireUserId(context.session), data.id);
  });

export const getSharedProjectFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ id: z.string(), token: z.string() }))
  .handler(async ({ data }) => {
    const service = await getProjectService();
    return service.getSharedProject(data.id, data.token);
  });
