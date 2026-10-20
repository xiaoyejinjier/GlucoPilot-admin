import { get, post, request } from '@/utils/request'
export interface ExportTask { id:string; userId:string; userName:string; status:'pending'|'processing'|'done'|'failed'; startDate:string; endDate:string; createdAt:string; finishedAt:string|null; error:string; glucoseCount:number; mealCount:number }
export const exportsApi = {
  list:(pageNum:number,pageSize:number,status:string,keyword:string)=>get<{records:ExportTask[];total:number;pages:number}>(`/admin/v1/exports?${new URLSearchParams({pageNum:String(pageNum),pageSize:String(pageSize),status,keyword})}`),
  generate:(id:string)=>post<ExportTask>(`/admin/v1/exports/${encodeURIComponent(id)}/generate`,undefined,{timeout:60000}),
  file:(id:string)=>request<Blob>(`/admin/v1/exports/${encodeURIComponent(id)}/file`,{responseType:'blob',timeout:60000})
}
