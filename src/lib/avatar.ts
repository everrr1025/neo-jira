export const AVATAR_PRESETS = [
  "/avatars/cartoon-01.svg",
  "/avatars/cartoon-02.svg",
  "/avatars/cartoon-03.svg",
  "/avatars/cartoon-04.svg",
  "/avatars/cartoon-05.svg",
  "/avatars/cartoon-06.svg",
  "/avatars/cartoon-07.svg",
  "/avatars/cartoon-08.svg",
  "/avatars/cartoon-09.svg",
  "/avatars/cartoon-10.svg",
  "/avatars/cartoon-11.svg",
  "/avatars/cartoon-12.svg",
] as const;

export function getAvatarStorageKey(userKey: string) {
  return `neo-jira:avatar:${userKey}`;
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getDefaultAvatar(userKey: string) {
  const idx = hashString(userKey) % AVATAR_PRESETS.length;
  return AVATAR_PRESETS[idx];
}
