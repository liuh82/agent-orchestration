export interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'archived' | 'deleted';
  created_by: string;
  created_at: string;
  updated_at: string;
}
