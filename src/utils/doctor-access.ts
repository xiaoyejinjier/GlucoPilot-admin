export interface AccessAccount { role: string; permissions?: string[]; menuPaths?: string[] }
export const doctorPages: Record<string, string> = {
  '/doctor-management/workbench': 'doctor:workbench:view',
  '/doctor-management/consultations': 'doctor:consultation:manage',
  '/doctor-management/income': 'doctor:income:view'
}
export function doctorPageAllowed(account: AccessAccount | null, path: string): boolean {
  return !!account && account.role === 'doctor' && !!doctorPages[path]
    && !!account.permissions?.includes(doctorPages[path]) && !!account.menuPaths?.includes(path)
}
export function landingPath(account: AccessAccount | null): string {
  return account?.role === 'doctor' ? Object.keys(doctorPages).find(path => doctorPageAllowed(account, path)) || '/no-access' : '/dashboard'
}
