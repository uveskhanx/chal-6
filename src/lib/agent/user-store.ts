import "server-only";
import { UserPreferences, DEFAULT_USER_PREFERENCES, UserPreferencesSchema } from "@/lib/recommendations/types";

// Thread-safe in-memory User Preference Store with user isolation
const userPreferencesStore = new Map<string, UserPreferences>();

export function getUserPreferences(userId: string): UserPreferences {
  if (!userPreferencesStore.has(userId)) {
    userPreferencesStore.set(userId, { ...DEFAULT_USER_PREFERENCES });
  }
  return { ...userPreferencesStore.get(userId)! };
}

export function updateUserPreferences(
  userId: string,
  updates: Partial<UserPreferences>
): { success: boolean; preferences: UserPreferences; error?: string } {
  const current = getUserPreferences(userId);
  const merged = { ...current, ...updates };

  const validation = UserPreferencesSchema.safeParse(merged);
  if (!validation.success) {
    return {
      success: false,
      preferences: current,
      error: "Invalid preference parameters: " + validation.error.message,
    };
  }

  userPreferencesStore.set(userId, validation.data);
  return { success: true, preferences: validation.data };
}

export function resetUserPreferences(userId: string): UserPreferences {
  userPreferencesStore.set(userId, { ...DEFAULT_USER_PREFERENCES });
  return { ...DEFAULT_USER_PREFERENCES };
}
