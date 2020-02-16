
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
  private rulesIndex: { [index: string]: LexerRule } = {};
  private rules: LexerRule[] = [];
  private src: string;
  private offset = 0;
  private lastOffset = 0;
  private eoi = false;

  private matchedRule: LexerRule = null;
  private matchedValue = null;

  public addRule(rule: LexerRule): Lexer {
    let r = this.rulesIndex[rule.name];
    if (r == undefined) {
      rule.id = this.rules.length;
      this.rules.push(rule);
    } else {
      throw new Error('Rule ' + rule.name + ' already exist');
    }

    this.rulesIndex[rule.name] = rule;
    return this;
  }

  public mark(): number {
    return this.lastOffset;
  }

  public reset(offset: number = 0): string {
    this.offset = offset;
    this.lastOffset = offset;
    this.eoi = false;
    return this.next();
  }

  public setSource(src: string): void {
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
    let subsrc = this.src.substr(this.offset);
    for (let i = 0; i < this.rules.length; i++) {
      let rule = this.rules[i];
      let match = rule.pattern.exec(subsrc);
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
      throw new Error('Unexpected input "' + subsrc.substr(0, 10) + '..."');

    return matchedRule.name;
  }

  public next(): string {
    return this.exec()
  }

  public rule(): LexerRule {
    return this.matchedRule;
  }

  public value(): any {
    return this.rule().conv(this.matchedValue[this.rule().mid]);
  }

  public isEoi(): boolean {
    return this.eoi;
  }
}
