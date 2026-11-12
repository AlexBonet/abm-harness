export const EXIT = Object.freeze({
  OK: 0,
  USAGE: 2,
  PLAN_CHANGED: 3,
  REFUSED: 4,
  APPLY_FAILED: 5,
})

export class AbmhError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

export const usageError = (message) => new AbmhError(EXIT.USAGE, message)

export const refused = (message) => new AbmhError(EXIT.REFUSED, message)

export const applyFailed = (message) => new AbmhError(EXIT.APPLY_FAILED, `ABMH_APPLY_FAILED: ${message}`)

export const planChanged = () =>
  new AbmhError(
    EXIT.PLAN_CHANGED,
    'ABMH_PLAN_CHANGED: the project or the options changed since the plan was printed. Nothing was written. Run the command again to get a new plan.',
  )
