import {get,post,put} from '@/utils/request'
export interface Withdrawal {orderNo:string;userId:string;doctorName?:string;amountCents:number;status:string;reviewNote:string;expectedPayoutDate:string|null;payoutReference:string|null;createdAt:string;version:string|number;provider?:string;payeeUserId?:string|null;transferState?:string;transferErrorCode?:string|null;transferStartedAt?:string|null;lastTransferAt?:string|null}
export interface WithdrawalSummary {eligible:boolean;sandbox:boolean;availableCents:string|number;frozenCents:string|number;businessDays:number;calendarRule:string;transferEnabled:boolean}
export interface WorkDay {calendar_date:string;working_day:number;note:string}
export const withdrawalApi={
  list:(pageNum:number,pageSize:number,status='')=>get<{records:Withdrawal[];total:string|number}>(`/admin/v1/doctor-withdrawals?pageNum=${pageNum}&pageSize=${pageSize}&status=${encodeURIComponent(status)}`),
  review:(order:Withdrawal,status:string,note:string)=>post<Withdrawal>(`/admin/v1/doctor-withdrawals/${encodeURIComponent(order.orderNo)}/review`,{status,note,version:order.version}),
  payout:(no:string)=>post<Withdrawal>(`/admin/v1/doctor-withdrawals/${encodeURIComponent(no)}/payout`,{},{timeout:60000}),
  refresh:(no:string)=>post<Withdrawal>(`/admin/v1/doctor-withdrawals/${encodeURIComponent(no)}/refresh`,{},{timeout:60000}),
  calendar:(start:string,end:string)=>get<WorkDay[]>(`/admin/v1/doctor-withdrawals/calendar?start=${start}&end=${end}`),
  saveDay:(date:string,workingDay:boolean,note:string)=>put('/admin/v1/doctor-withdrawals/calendar',{date,workingDay,note}),
  ownSummary:()=>get<WithdrawalSummary>('/admin/v1/doctor/withdrawals/summary'),
  ownList:()=>get<{records:Withdrawal[];total:string|number}>('/admin/v1/doctor/withdrawals?pageNum=1&pageSize=50'),
  apply:(amountCents:number,clientRequestId:string,payeeUserId:string)=>post('/admin/v1/doctor/withdrawals',{amountCents,clientRequestId,payeeUserId}),
  recipient:(no:string,payeeUserId:string)=>post(`/admin/v1/doctor/withdrawals/${encodeURIComponent(no)}/recipient`,{payeeUserId}),
  refreshOwn:()=>post('/admin/v1/doctor/withdrawals/refresh',{},{timeout:60000})
}
