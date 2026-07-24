export const SCOPES = {
  PROFILE: 'profile',
  FOOD: 'food',
  DIARY: 'diary',
} as const;

export type Scope = (typeof SCOPES)[keyof typeof SCOPES];

export const ALL_SCOPES: Scope[] = [SCOPES.PROFILE, SCOPES.FOOD, SCOPES.DIARY];
