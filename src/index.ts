import { DMMF as ExternalDMMF, ExternalDMMF as DMMF } from './dmmf/dmmf-types';
import { transformDMMF } from './dmmf/dmmf-transformer';
import * as fs from 'fs';
import * as path from 'path';
import { generateNexusPrismaTypes } from './typegen';
import { GeneratorFunction, GeneratorDefinition } from '@prisma/cli';
import { promisify } from 'util';

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

function getImportPathRelativeToOutput(from: string, to: string): string {
  if (to.includes('node_modules')) {
    return to.substring(
      to.lastIndexOf('node_modules') + 'node_modules'.length + 1
    );
  }

  let relativePath = path.relative(from, to);

  if (!relativePath.startsWith('.')) {
    relativePath = './' + relativePath;
  }

  // remove .ts or .js file extension
  relativePath = relativePath.replace(/\.(ts|js)$/, '');

  // remove /index
  relativePath = relativePath.replace(/\/index$/, '');

  // replace \ with /
  relativePath = relativePath.replace(/\\/g, '/');

  return relativePath;
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

  const output = generator.output || path.join(cwd, '/generated/nexus-prisma');
  const photonGeneratorOutput = photonGenerator.output || '@generated/photon';
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

  await Promise.all([
    writeFileAsync(path.join(output, 'index.js'), nexusPrismaRuntime),
    writeFileAsync(
      path.join(output, 'nexus-prisma.d.ts'),
      generateNexusPrismaTypes(
        dmmf,
        getImportPathRelativeToOutput(output, photonGeneratorOutput)
      )
    ),
    copyFileAsync(
      path.join(__dirname, 'nexus-prisma', 'index.d.ts'),
      path.join(output, 'index.d.ts')
    )
  ]);

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
      output: path.join(__dirname, '../example/generated/nexus-prisma'),
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
