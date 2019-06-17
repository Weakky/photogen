import { NexusPrismaBuilder } from './NexusPrismaBuilder';

export interface PhotogenParams {
  photon: (ctx: any) => any;
}

export function photogenMethod(params: PhotogenParams) {
  const builder = new NexusPrismaBuilder(params);

  return builder.getPhotogenMethod();
}
