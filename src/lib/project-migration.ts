import type { ProjectRecord } from './db/types';

export function planLocalProjectImports({
  localProjects,
  cloudProjects,
}: {
  localProjects: ProjectRecord[];
  cloudProjects: ProjectRecord[];
}): ProjectRecord[] {
  const cloudIds = new Set(cloudProjects.map((project) => project.id));
  return localProjects.filter((project) => !cloudIds.has(project.id));
}
