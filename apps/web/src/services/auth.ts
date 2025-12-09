import type { User } from '@terminal/shared';
import { apiRequest } from './http';

export async function fetchCurrentUser(): Promise<User> {
  return apiRequest<User>('/auth/me');
}
