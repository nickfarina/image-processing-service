export class TransformLimiter {
  private active = 0;

  constructor(private readonly maximum: number) {}

  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.active >= this.maximum) {
      throw new TransformCapacityError();
    }

    this.active += 1;
    try {
      return await operation();
    } finally {
      this.active -= 1;
    }
  }
}

export class TransformCapacityError extends Error {
  constructor() {
    super('The service is temporarily at transformation capacity.');
  }
}
