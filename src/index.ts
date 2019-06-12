import { DMMF as ExternalDMMF, ExternalDMMF as DMMF } from './dmmf/dmmf-types';
import { transformDMMF } from './dmmf/dmmf-transformer';
import * as fs from 'fs';
import { join } from 'path';
import { generatePhotogenTypes } from './typegen';
import { GeneratorFunction, GeneratorDefinition } from '@prisma/cli';
import { promisify } from 'util';

const writeFileAsync = promisify(fs.writeFile);
const copyFileAsync = promisify(fs.copyFile);

function getPhotogenRuntime() {
  const dmmf = require('@generated/photon').dmmf as ExternalDMMF.Document;
  const transformedDmmf = transformDMMF(dmmf);
  const nccedLibrary = fs
    .readFileSync(join(__dirname, '../ncc_build/index.js'))
    .toString();
  const nccedLibraryWithDMMF = nccedLibrary.replace(
    '__DMMF__',
    JSON.stringify(transformedDmmf)
  );

  return { photogenRuntime: nccedLibraryWithDMMF, dmmf: transformedDmmf };
}

const generate: GeneratorFunction = async ({ generator, cwd }) => {
  const output = join(cwd, generator.output || '/generated/photogen');
  const { photogenRuntime, dmmf } = getPhotogenRuntime();

  // Create the output directories if needed (mkdir -p)
  if (!fs.existsSync(output)) {
    try {
      fs.mkdirSync(output, { recursive: true });
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
  }

  await Promise.all([
    writeFileAsync(join(output, 'index.js'), photogenRuntime),
    writeFileAsync(join(output, 'photogen.d.ts'), generatePhotogenTypes(dmmf)),
    copyFileAsync(
      join(__dirname, 'photogen', 'index.d.ts'),
      join(output, 'index.d.ts')
    )
  ]);

  return '';
};

export const generatorDefinition: GeneratorDefinition = {
  generate,
  prettyName: 'Photogen'
};
