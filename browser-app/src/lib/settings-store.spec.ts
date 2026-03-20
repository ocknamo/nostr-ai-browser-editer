import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteProjectProfile,
  loadCurrentSettings,
  loadProjectProfiles,
  saveCurrentSettings,
  saveProjectProfile,
} from './settings-store';

// Minimal in-memory localStorage mock.
function createLocalStorageMock() {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const k of Object.keys(store)) {
        delete store[k];
      }
    },
  };
}

const localStorageMock = createLocalStorageMock();

beforeEach(() => {
  localStorageMock.clear();
  vi.stubGlobal('localStorage', localStorageMock);
});

describe('loadCurrentSettings', () => {
  it('returns default settings when nothing is stored', () => {
    expect(loadCurrentSettings()).toEqual({
      repo: '',
      branch: '',
      openFile: '',
      projectRoot: '',
    });
  });

  it('returns stored settings when they exist', () => {
    const settings = {
      repo: 'owner/repo',
      branch: 'main',
      openFile: 'src/App.svelte',
      projectRoot: '',
    };
    localStorage.setItem(
      'nostr-ai-browser-editer:current-settings',
      JSON.stringify(settings),
    );
    expect(loadCurrentSettings()).toEqual(settings);
  });

  it('merges stored partial settings with defaults', () => {
    localStorage.setItem(
      'nostr-ai-browser-editer:current-settings',
      JSON.stringify({ repo: 'owner/repo' }),
    );
    expect(loadCurrentSettings()).toEqual({
      repo: 'owner/repo',
      branch: '',
      openFile: '',
      projectRoot: '',
    });
  });

  it('returns defaults when stored value is invalid JSON', () => {
    localStorage.setItem(
      'nostr-ai-browser-editer:current-settings',
      'not-json',
    );
    expect(loadCurrentSettings()).toEqual({
      repo: '',
      branch: '',
      openFile: '',
      projectRoot: '',
    });
  });
});

describe('saveCurrentSettings', () => {
  it('persists settings to localStorage', () => {
    const settings = {
      repo: 'owner/repo',
      branch: 'dev',
      openFile: '',
      projectRoot: 'app',
    };
    saveCurrentSettings(settings);
    const raw = localStorage.getItem(
      'nostr-ai-browser-editer:current-settings',
    );
    const parsed = raw !== null ? JSON.parse(raw) : null;
    expect(parsed).toEqual(settings);
  });
});

describe('loadProjectProfiles', () => {
  it('returns an empty array when nothing is stored', () => {
    expect(loadProjectProfiles()).toEqual([]);
  });

  it('returns stored profiles', () => {
    const profiles = [
      {
        id: '1',
        name: 'My Project',
        repo: 'owner/repo',
        branch: 'main',
        openFile: '',
        projectRoot: '',
        createdAt: 1000,
      },
    ];
    localStorage.setItem(
      'nostr-ai-browser-editer:project-profiles',
      JSON.stringify(profiles),
    );
    expect(loadProjectProfiles()).toEqual(profiles);
  });

  it('returns an empty array when stored value is invalid JSON', () => {
    localStorage.setItem(
      'nostr-ai-browser-editer:project-profiles',
      'not-json',
    );
    expect(loadProjectProfiles()).toEqual([]);
  });
});

describe('saveProjectProfile', () => {
  it('adds a new profile and persists it', () => {
    saveProjectProfile({
      name: 'Test',
      repo: 'owner/repo',
      branch: 'main',
      openFile: '',
      projectRoot: '',
    });
    const profiles = loadProjectProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe('Test');
    expect(profiles[0].repo).toBe('owner/repo');
    expect(typeof profiles[0].id).toBe('string');
    expect(typeof profiles[0].createdAt).toBe('number');
  });

  it('appends to existing profiles', () => {
    saveProjectProfile({
      name: 'First',
      repo: 'a/b',
      branch: 'main',
      openFile: '',
      projectRoot: '',
    });
    saveProjectProfile({
      name: 'Second',
      repo: 'c/d',
      branch: 'dev',
      openFile: '',
      projectRoot: '',
    });
    expect(loadProjectProfiles()).toHaveLength(2);
  });
});

describe('deleteProjectProfile', () => {
  it('removes the profile with the given id', () => {
    saveProjectProfile({
      name: 'Keep',
      repo: 'a/b',
      branch: 'main',
      openFile: '',
      projectRoot: '',
    });
    saveProjectProfile({
      name: 'Delete',
      repo: 'c/d',
      branch: 'main',
      openFile: '',
      projectRoot: '',
    });
    const [keep, del] = loadProjectProfiles();
    deleteProjectProfile(del.id);
    const remaining = loadProjectProfiles();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(keep.id);
  });

  it('does nothing when the given id does not exist', () => {
    saveProjectProfile({
      name: 'Keep',
      repo: 'a/b',
      branch: 'main',
      openFile: '',
      projectRoot: '',
    });
    deleteProjectProfile('nonexistent-id');
    expect(loadProjectProfiles()).toHaveLength(1);
  });
});
