export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

export interface PagedData<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
