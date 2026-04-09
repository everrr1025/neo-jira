export function countPasswordCategories(password: string) {
  let categories = 0;
  if (/[A-Z]/.test(password)) categories += 1;
  if (/[a-z]/.test(password)) categories += 1;
  if (/[0-9]/.test(password)) categories += 1;
  if (/[^A-Za-z0-9]/.test(password)) categories += 1;
  return categories;
}

export function isValidPassword(password: string) {
  return password.length >= 8 && countPasswordCategories(password) >= 3;
}
