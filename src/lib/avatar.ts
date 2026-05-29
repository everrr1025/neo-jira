export const AVATAR_PRESETS = [
  "/avatars/01.png",
  "/avatars/02.png",
  "/avatars/03.png",
  "/avatars/04.png",
  "/avatars/05.png",
  "/avatars/06.png",
  "/avatars/07.png",
  "/avatars/08.png",
  "/avatars/09.png",
  "/avatars/10.png",
  "/avatars/11.png",
  "/avatars/12.png",
  "/avatars/13.png",
  "/avatars/14.png",
  "/avatars/15.png",
  "/avatars/16.png",
  "/avatars/17.png",
  "/avatars/18.png",
  "/avatars/19.png",
  "/avatars/20.png",
  "/avatars/21.png",
  "/avatars/22.png",
  "/avatars/23.png",
  "/avatars/24.png",
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
