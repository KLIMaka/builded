import { ValuesContainer, Source } from "ts-utils/callbacks";
import { begin, Work } from "ts-utils/work";
import { boolRule, nestedRule, number, numberRule, push, pushField, rule, rules, rulesInclude, ScriptFile, set, simpleRule, stringRule, token, tuple } from "@utils/scriptfile";
import { FileSystem } from "app/apis/fs";
import { identity, nil } from "ts-utils/types";
import { asyncMapOptional } from "ts-utils/objects";
import { createGrpOrZipFsArrayBuffer, stack } from "../fs/fs";

export type RffIdDef = Readonly<{ name: string, type: string, id: number, rff: string }>;
export type EngineDefs = {
  rffIdDefs: RffIdDef[],
}

export function loadEngineDefsWork(fs: FileSystem, values: ValuesContainer): Work<[Source<FileSystem>, Source<GrpInfo>], [Source<EngineDefs>]> {
  const files = new Set<string>();
  const loadGrp = async (sf: ScriptFile, defs: EngineDefs, fn: string): Promise<void> => {
    await begin()
      .then(`Loading ${fn}`, async () => defs.root.read(fn))
      .then(`Processing ${fn}`, async opt => asyncMapOptional(opt, ab => createGrpOrZipFsArrayBuffer(ab))
        .then(o => o.ifPresent(grp => {
          defs.addGrp = stack(grp, defs.addGrp);
          fs = stack(defs.addGrp, fs);
          files.add(fn);
        })))
      .finish()(sf.taskHandle);
  }
  const defsFile = rulesInclude(inc => fs.read(inc), files,
    rule(['loadgrp'], tuple(token), loadGrp),
    simpleRule(['rffdefineid'], tuple(token, token, number, token), (defs, name, type, id, rff) => defs.rffIdDefs.push({ name, type, id, rff })),
    nestedRule(['tilefromtexture'],)

  )
}