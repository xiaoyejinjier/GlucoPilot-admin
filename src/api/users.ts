import { get } from '@/utils/request'
export interface UserDetail {id:string;username:string;nickname:string;avatarText:string;phone:string|null;phoneMasked:string|null;age:number|null;diabetesTypeText:string;accountStatus:number;registeredAt:string|null;lastActiveAt:string|null;recordCount:number;mealCount:number;complianceRate:number}
export const userDetailsApi={get:(id:number)=>get<UserDetail>(`/admin/v1/users/${encodeURIComponent(id)}`)}
