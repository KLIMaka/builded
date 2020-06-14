

class Generator1 {
  private chain: string[] = [];

  constructor() {
    this.chain.push(`const op0 = data[i];`);
  }

  private lastStage() { return `op${this.chain.length - 1}` }

  map(op: string): Generator1 {
    const lastStage = this.lastStage();
    op = op.replace(/x/g, lastStage);
    this.chain.push(`const op${this.chain.length} = ${op};`);
    return this;
  }

  filter(op: string): Generator1 {
    const lastStage = this.lastStage();
    op = op.replace(/x/g, lastStage);
    this.chain.push(`if (!(${op})) continue; const op${this.chain.length} = ${lastStage};`);
    return this;
  }

  gen(): (data: []) => [] {
    const lastStage = this.lastStage();
    let fn = 'return function (data){ const result = [];for (let i = 0; i < data.length; i++) {' + this.chain.join(' ') + `result.push(${lastStage});} return result;}`
    return <(data: []) => []>new Function(fn)();
  }
}

function pow(x: number) {
  return x * x + 1;
}

test('', () => {

})