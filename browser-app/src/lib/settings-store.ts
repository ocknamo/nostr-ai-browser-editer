/** Keys used for localStorage persistence. */
const CURRENT_SETTINGS_KEY = 'nostr-ai-browser-editer:current-settings';
const PROJECT_PROFILES_KEY = 'nostr-ai-browser-editer:project-profiles';

/** The four settings values shared across the app. */
export interface CurrentSettings {
  repo: string;
  branch: string;
  openFile: string;
  projectRoot: string;
}

/** A named snapshot of settings that can be saved and restored. */
export interface ProjectProfile {
  id: string;
  name: string;
  repo: string;
  branch: string;
  openFile: string;
  projectRoot: string;
  createdAt: number;
}

const DEFAULT_SETTINGS: CurrentSettings = {
  repo: '',
  branch: '',
  openFile: '',
  projectRoot: '',
};

/** Load the last auto-saved settings from localStorage. Returns defaults if none exist. */
export function loadCurrentSettings(): CurrentSettings {
  try {
    const raw = localStorage.getItem(CURRENT_SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Persist the current settings to localStorage. */
export function saveCurrentSettings(settings: CurrentSettings): void {
  try {
    localStorage.setItem(CURRENT_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore write errors (e.g. private browsing quota exceeded).
  }
}

/** Load all saved project profiles from localStorage. */
export function loadProjectProfiles(): ProjectProfile[] {
  try {
    const raw = localStorage.getItem(PROJECT_PROFILES_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** Save a new project profile. Existing profiles are preserved. */
export function saveProjectProfile(profile: Omit<ProjectProfile, 'id' | 'createdAt'>): void {
  const profiles = loadProjectProfiles();
  const newProfile: ProjectProfile = {
    ...profile,
    id: String(Date.now()),
    createdAt: Date.now(),
  };
  profiles.push(newProfile);
  try {
    localStorage.setItem(PROJECT_PROFILES_KEY, JSON.stringify(profiles));
  } catch {
    // Ignore write errors.
  }
}

/** Delete the profile with the given id. */
export function deleteProjectProfile(id: string): void {
  const profiles = loadProjectProfiles().filter((p) => p.id !== id);
  try {
    localStorage.setItem(PROJECT_PROFILES_KEY, JSON.stringify(profiles));
  } catch {
    // Ignore write errors.
  }
}
