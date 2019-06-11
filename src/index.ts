#!/usr/bin/env node
import { DMMF as ExternalDMMF, ExternalDMMF as DMMF } from './dmmf/dmmf-types';
import { transformDMMF } from './dmmf/dmmf-transformer';
import * as fs from 'fs';
import { join } from 'path';
import { generatePhotogenTypes } from './typegen';

generatePhotogen(join(process.cwd(), process.argv[2]));

export function generatePhotogen(outputDir: string) {
  const dmmf = require('@generated/photon').dmmf as ExternalDMMF.Document;
  const transformedDmmf = transformDMMF(dmmf);
  const nccedLibrary = fs
    .readFileSync(join(__dirname, '../ncc_build/index.js'))
    .toString();
  const nccedLibraryWithDMMF = nccedLibrary.replace(
    '__DMMF__',
    JSON.stringify(transformedDmmf)
  );

  if (!fs.existsSync(outputDir)) {
    try {
      // Create the output directories if needed (mkdir -p)
      fs.mkdirSync(outputDir, { recursive: true });
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
  }

  fs.writeFileSync(join(outputDir, 'index.js'), nccedLibraryWithDMMF);
  fs.writeFileSync(
    join(outputDir, 'photogen.d.ts'),
    generatePhotogenTypes(transformedDmmf)
  );
  fs.copyFileSync(
    join(__dirname, 'photogen', 'index.d.ts'),
    join(outputDir, 'index.d.ts')
  );
}
