export class InputLimitError extends RangeError {
  public override readonly name = "InputLimitError" as const;

  public constructor(actualLength: number, maximumLength: number) {
    super(
      `User-Agent length ${String(actualLength)} exceeds limit ${String(maximumLength)}`,
    );
  }
}

export class RuleValidationError extends TypeError {
  public override readonly name = "RuleValidationError" as const;

  public constructor(message: string) {
    super(message);
  }
}
