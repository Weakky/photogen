import { PhotogenBuilder } from './PhotogenBuilder';

export interface PhotogenParams {
  methodName?: string;
  photon: (ctx: any) => any;
}

export function photogenMethod(params: PhotogenParams) {
  const builder = new PhotogenBuilder(params);

  return builder.getPhotogenMethod();
}
