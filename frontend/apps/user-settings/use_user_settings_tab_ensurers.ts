export type UserSettingsTabEnsurers = {
  ensureUsersLoaded: (force: boolean) => Promise<void>;
  ensureDbSettingsLoaded: (force: boolean) => Promise<void>;
};

export function createUserSettingsTabEnsurers(): UserSettingsTabEnsurers {
  return {
    async ensureUsersLoaded(): Promise<void> {},
    async ensureDbSettingsLoaded(): Promise<void> {},
  };
}
