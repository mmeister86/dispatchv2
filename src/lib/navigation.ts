export function returnPath(value: string | null) {
  if (
    !value?.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u001f\u007f]/.test(value)
  )
    return "/overview";
  const target = new URL(value, "https://dispatch.invalid");
  return target.origin === "https://dispatch.invalid" &&
    !target.pathname.startsWith("//") &&
    !/^\/(login|signup|verify|reset-password)(\/|$)/.test(target.pathname)
    ? target.pathname + target.search + target.hash
    : "/overview";
}
export function authPath(
  path: "/login" | "/signup" | "/verify" | "/reset-password" | "/onboarding",
  destination: string | null,
) {
  return `${path}?${new URLSearchParams({ returnTo: returnPath(destination) })}`;
}
