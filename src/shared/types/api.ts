export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  policyReviewRequired?: boolean;
}
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: Pagination;
}
export type RecordData = Record<string, unknown>;
export interface Grant {
  permission: string;
  scope: string;
}
export interface Profile {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber: string;
  roleId: string;
  branchId: string | null;
  reportingManagerId: string | null;
  grants: Grant[];
}
