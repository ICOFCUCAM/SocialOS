/**
 * Resolve immutable content for one destination. Account-specific versions
 * take precedence; legacy caption overrides are honoured during migration.
 */
export function resolveTargetContent({ defaultVersion, accountVersion = null, target = {} }) {
  if (!defaultVersion) throw new Error("A default social post content version is required.");
  const selected = accountVersion || defaultVersion;
  return {
    ...selected,
    body: accountVersion ? accountVersion.body : (target.caption_override ?? defaultVersion.body),
    platform_options: accountVersion?.platform_options ?? target.platform_options ?? defaultVersion.platform_options ?? {},
    versionId: selected.id,
    isAccountSpecific: Boolean(accountVersion)
  };
}
