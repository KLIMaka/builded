export class CachedValue<T> {
  private valid = false;
  constructor(
    private supplier: (value: T) => T,
    private cached: T = null) { }

  public get() {
    if (!this.valid) {
      this.cached = this.supplier(this.cached);
      this.valid = true;
    }
    return this.cached;
  }

  public invalidate() { this.valid = false }
}