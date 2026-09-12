export type ListKind = 'project' | 'shopping' | 'area';

export interface List {
  id: string;
  name: string;
  kind: ListKind;
  color: string;
  icon: string;
  order: number;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
}
