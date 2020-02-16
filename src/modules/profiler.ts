
function now() {
  return window.performance.now();
}

export class Section {
  constructor(
    public parent: Section,
    public name: string,
    public startTime: number = now(),
    public time: number = 0,
    public subSections = {},
    public counts = {}) {
    if (parent != null)
      parent.subSections[name] = this;
  }

  public start() {
    if (this.startTime == -1)
      this.startTime = now();
  }

  public stop() {
    if (this.startTime != -1) {
      this.time = now() - this.startTime;
      this.startTime = -1;
    }
    return this.time;
  }

  public pause() {
    if (this.startTime != -1) {
      this.time += now() - this.startTime;
      this.startTime = -1;
    }
    return this.time;
  }

  public currentTime() {
    return this.startTime == -1 ? this.time : now() - this.startTime;
  }

  public createSubsection(name: string): Section {
    return new Section(this, name);
  }

  public inc(name: string, amount = 1) {
    let count = this.counts[name];
    this.counts[name] = (count == undefined ? 0 : count) + amount;
  }

  public set(name: string, value: any) {
    this.counts[name] = value;
  }
}

let mainSection = new Section(null, 'Main');
let currentSection: Section = mainSection;

export function startProfile(name: string) {
  let subsec = currentSection.subSections[name];
  if (subsec == undefined) {
    subsec = new Section(currentSection, name);
  }
  currentSection = subsec;
  currentSection.start();
}

export function startGlobalProfile(name: string) {
  let subsec = mainSection.subSections[name];
  if (subsec == undefined) {
    subsec = new Section(mainSection, name);
    subsec.parent = currentSection;
  }
  currentSection = subsec;
  currentSection.start();
}

export function incCount(name: string, amount = 1) {
  currentSection.inc(name, amount);
}

export function set(name: string, value: any) {
  currentSection.set(name, value);
}

export function endProfile() {
  let time = currentSection.pause();
  if (currentSection != mainSection)
    currentSection = currentSection.parent;
  return time;
}

export function start() {
  mainSection = new Section(null, 'Main');
  currentSection = mainSection;
}

export function get(path: string = null): Section {
  if (path == null)
    return mainSection;
  let parts = path.split('.');
  let section = mainSection;
  for (let i = 0; i < parts.length; i++) {
    section = section.subSections[parts[i]];
  }
  return section;
}