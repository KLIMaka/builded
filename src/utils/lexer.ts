
export class LexerRule {
  public id: number = null;
  constructor(
    public pattern: RegExp,
    public name: string,
    public mid = 0,
    public conv: (s: string) => any = (s: string) => s
  ) { }
}

export class Lexer {
  private rulesIndex = new Map<string, LexerRule>();
  private rules: LexerRule[] = [];
  private src: string;
  private offset = 0;
  private lastOffset = 0;
  private eoi = false;

  private matchedRule: LexerRule = null;
  private matchedValue: RegExpMatchArray = null;

  addRule(rule: LexerRule): this {
    const r = this.rulesIndex.get(rule.name);
    if (r === undefined) {
      rule.id = this.rules.length;
      this.rules.push(rule);
    } else {
      throw new Error('Rule ' + rule.name + ' already exist');
    }

    this.rulesIndex.set(rule.name, rule);
    return this;
  }

  add(pattern: RegExp, name: string, mid = 0, conv: (s: string) => any = s => s) {
    return this.addRule(new LexerRule(pattern, name, mid, conv))
  }

  mark(): number {
    return this.lastOffset;
  }

  reset(offset: number = 0): string {
    this.offset = offset;
    this.lastOffset = offset;
    this.eoi = false;
    return this.next();
  }

  setSource(src: string): void {
    this.src = src;
    this.offset = 0;
    this.eoi = false;
  }

  private exec(): string {
    if (this.offset >= this.src.length) this.eoi = true;
    if (this.eoi) return null;

    let len = 0;
    let matchedValue = null;
    let matchedRule: LexerRule = null;
    let subsrc = this.src.substring(this.offset);
    for (const rule of this.rules) {
      const match = rule.pattern.exec(subsrc);
      if (match != null && match[0].length >= len) {
        matchedValue = match;
        matchedRule = rule;
        len = match[0].length;
      }
    }

    this.matchedRule = matchedRule;
    this.matchedValue = matchedValue;
    this.lastOffset = this.offset;
    this.offset += len;

    if (matchedRule == null)
      throw new Error('Unexpected input "' + subsrc.substring(0, 10) + '..."');

    return matchedRule.name;
  }

  next(): string {
    return this.exec()
  }

  rule(): LexerRule {
    return this.matchedRule;
  }

  value(): any {
    return this.rule().conv(this.matchedValue[this.rule().mid]);
  }

  isEoi(): boolean {
    return this.eoi;
  }
}
