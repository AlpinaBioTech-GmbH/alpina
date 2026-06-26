/** Serializable outcome of an admin server action, toasted by client islands. */
export interface ActionResult {
  ok: boolean;
  message: string;
  url?: string;
}
