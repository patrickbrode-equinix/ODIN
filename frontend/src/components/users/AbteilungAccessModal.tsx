/* ------------------------------------------------ */
/* ABTEILUNG ACCESS MODAL – ALIAS / COMPAT          */
/* ------------------------------------------------ */
/**
 * Hintergrund:
 * - Users.tsx importiert (nach Cleanup) AbteilungAccessModal.
 * - Die bestehende Implementierung heißt GroupAccessModal.
 * - Dieses File ist ein dünner Alias, um White-Screen/Import-Errors zu vermeiden.
 *
 * Hinweis:
 * - Funktional identisch zum GroupAccessModal.
 * - UI-Texte können wir später konsistent auf "Abteilung" umstellen.
 */

import { GroupAccessModal } from "./GroupAccessModal";

/* ------------------------------------------------ */
/* TYPES                                            */
/* ------------------------------------------------ */

type AbteilungAccessModalProps = {
  open: boolean;
  onClose: () => void;
};

/* ------------------------------------------------ */
/* COMPONENT                                        */
/* ------------------------------------------------ */

export function AbteilungAccessModal({ open, onClose }: AbteilungAccessModalProps) {
  return <GroupAccessModal open={open} onClose={onClose} />;
}
