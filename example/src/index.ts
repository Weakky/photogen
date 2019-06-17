import Photon from '@generated/photon';
import { GraphQLServer } from 'graphql-yoga';
import { makeSchema } from 'nexus-tmp-chainable-method';
import { join } from 'path';
import { photogenMethod } from '../generated/nexus-prisma';
import * as allTypes from './graphql';

main();

async function main() {
  const photon = new Photon();

  await photon.connect();

  const photogen = photogenMethod({
    photon: ctx => ctx.photon
  });

  const schema = makeSchema({
    types: [allTypes, photogen],
    outputs: {
      typegen: join(__dirname, '../generated/nexus-typegen.ts'),
      schema: join(__dirname, '/schema.graphql')
    },
    typegenAutoConfig: {
      sources: [
        {
          source: '@generated/photon',
          alias: 'photon'
        }
      ]
    }
  });

  const server = new GraphQLServer({
    schema,
    context: () => ({ photon })
  });

  server.start(() => console.log(`🚀 Server ready at http://localhost:4000`));
}
