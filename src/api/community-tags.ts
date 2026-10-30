import { get,post,put,del } from '@/utils/request'
import type { CommunityPage } from './community'
export interface ManagedTag { id:string;code:string;name:string;type:'OFFICIAL'|'USER';sortNo:number;enabled:number;articleCount:number }
export interface TagChange { name:string;sortNo:number;enabled:number }
export const communityTagsApi={
  list:(query:{keyword:string;type:string;enabled:string;pageNum:number;pageSize?:number})=>get<CommunityPage<ManagedTag>>('/admin/v1/community/tags?'+new URLSearchParams(Object.entries({...query,pageSize:query.pageSize??10}).filter(([,v])=>v!==''&&v!=null).map(([k,v])=>[k,String(v)])).toString()),
  create:(data:TagChange)=>post<ManagedTag>('/admin/v1/community/tags',data),
  update:(code:string,data:TagChange)=>put<ManagedTag>(`/admin/v1/community/tags/${encodeURIComponent(code)}`,data),
  remove:(code:string)=>del(`/admin/v1/community/tags/${encodeURIComponent(code)}`)
}
