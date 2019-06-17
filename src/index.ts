import { GeneratorDefinition, GeneratorFunction } from '@prisma/cli';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { transformDMMF } from './dmmf/dmmf-transformer';
import { DMMF as ExternalDMMF } from './dmmf/dmmf-types';
import { generateNexusPrismaTypes } from './typegen';
import { getImportPathRelativeToOutput } from './utils';

const writeFileAsync = promisify(fs.writeFile);
const copyFileAsync = promisify(fs.copyFile);

function getNexusPrismaRuntime(photonOutput: string) {
  const dmmf = require(photonOutput).dmmf as ExternalDMMF.Document;
  const transformedDmmf = transformDMMF(dmmf);
  const nccPath = eval(
    `path.join(__dirname, '../nexus_prisma_ncc_build/index.js')`
  );
  const nccedLibrary = fs.readFileSync(nccPath).toString();
  const nccedLibraryWithDMMF = nccedLibrary.replace(
    '__DMMF__',
    JSON.stringify(transformedDmmf)
  );

  return { nexusPrismaRuntime: nccedLibraryWithDMMF, dmmf: transformedDmmf };
}

const generate: GeneratorFunction = async ({
  generator,
  cwd,
  otherGenerators
}) => {
  const photonGenerator = otherGenerators.find(generator =>
    ['photon', 'photonjs'].includes(generator.name)
  );

  if (!photonGenerator) {
    throw new Error(
      'Nexus prisma needs a photon generator to be defined in the datamodel'
    );
  }

  const output =
    generator.output || path.join(cwd, '/node_modules/@generated/nexus-prisma');
  const photonGeneratorOutput = photonGenerator.output!;
  const { nexusPrismaRuntime, dmmf } = getNexusPrismaRuntime(
    photonGeneratorOutput
  );

  // Create the output directories if needed (mkdir -p)
  if (!fs.existsSync(output)) {
    try {
      fs.mkdirSync(output, { recursive: true });
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
  }

  const runtimePath = path.join(output, 'index.js');
  const globalTypingsPath = path.join(output, 'index.d.ts');

  const typingsPathSource = path.join(__dirname, 'nexus-prisma', 'index.d.ts');
  //const typingsPathTarget = path.join(output, 'index.d.ts');

  try {
    fs.unlinkSync(globalTypingsPath);
  } catch {}

  await Promise.all([
    writeFileAsync(runtimePath, nexusPrismaRuntime),
    writeFileAsync(
      globalTypingsPath,
      generateNexusPrismaTypes(
        dmmf,
        getImportPathRelativeToOutput(output, photonGeneratorOutput)
      )
    )
  ]);

  const typingsPathContent = fs.readFileSync(typingsPathSource).toString();
  fs.appendFileSync(globalTypingsPath, typingsPathContent);

  return '';
};

export const generatorDefinition: GeneratorDefinition = {
  generate,
  prettyName: 'Nexus Prisma'
};

if (process.env.NEXUS_PRISMA_DEBUG) {
  generatorDefinition.generate({
    cwd: process.cwd(),
    generator: {
      output: path.join(
        __dirname,
        '../example/node_modules/@generated/nexus-prisma'
      ),
      config: {},
      name: 'Nexus Prisma'
    },
    otherGenerators: [
      {
        name: 'photon',
        config: {},
        output: path.join(
          __dirname,
          '../example/node_modules/@generated/photon'
        )
      }
    ]
  });
}
