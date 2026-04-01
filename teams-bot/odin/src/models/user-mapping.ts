/**
 * User mapping model — maps ODIN employees to Teams identities.
 */

export interface UserMapping {
  /** ODIN employee ID (e.g. "emp-123") */
  employeeId: string;
  /** Display name as used in ODIN (e.g. "Mustermann, Max") */
  displayName: string;
  /** Email address (used for UPN matching) */
  email: string;
  /** Teams user ID (from activity.from.id) — populated when user interacts with bot */
  teamsUserId?: string;
  /** Azure AD Object ID — populated when user interacts with bot */
  aadObjectId?: string;
  /** User Principal Name — populated when available */
  upn?: string;
  /** Whether this mapping is active */
  enabled: boolean;
}
