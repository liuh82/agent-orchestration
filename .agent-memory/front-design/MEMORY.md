# Front-Design Agent Memory

## Project Patterns
- See [patterns.md](./patterns.md) for detailed project patterns

## Key Gotchas
- **Recharts `Bar` radius**: The `radius` prop expects `number | number[]`, but design tokens store string values like `'4px'`. Use `Number(radius.sm)` to convert.
- **Recharts tooltip**: Must use `contentStyle` object (not styled-components) for dark theme styling.
- **react-query pattern**: `useQuery<ApiResponse<T>, Error>(['key'], () => api.get('/path') as Promise<any>)` -- the `as Promise<any>` cast is required because the axios interceptor unwraps the response.
- **API client**: `api` from `@/api/client` is an axios instance with response interceptor that returns `response.data` directly.

## Design Token Usage
- Always import from `@/styles/tokens/{color,spacing,typography,radius,shadow,animation}`
- Never hardcode hex colors or pixel values
- `animation` token is only needed when using transition/animation CSS properties; omit the import otherwise (TS6133 unused error)

## File Structure
- Admin pages: `frontend/src/pages/admin/`
- Common components: `frontend/src/components/common/` (PageHeader, ErrorBlock, StatusBadge, EmptyState)
- API types: `frontend/src/types/api.ts` (ApiResponse<T>, PagedData<T>)
